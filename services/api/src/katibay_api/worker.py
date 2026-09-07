"""Worker entrypoint for processing queued Katibay jobs."""

import asyncio
import contextlib
import logging
import signal
import sys
import uuid

from katibay_api.jobs.queue import JobQueue, get_job_queue
from katibay_api.jobs.registry import HandlerRegistry, handler_registry
from katibay_api.logging import logger, setup_logging


class QueueWorker:
    """Worker instance polling the Postgres-backed queue and executing job handlers."""

    def __init__(
        self,
        worker_id: str | None = None,
        queue: JobQueue | None = None,
        registry: HandlerRegistry | None = None,
        poll_interval_sec: float = 1.0,
        visibility_timeout_sec: int = 60,
    ) -> None:
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.queue = queue or get_job_queue()
        self.registry = registry or handler_registry
        self.poll_interval = poll_interval_sec
        self.visibility_timeout = visibility_timeout_sec
        self.running = False
        self._stop_event = asyncio.Event()

    async def run(self) -> None:
        """Main execution loop for worker."""
        self.running = True
        logger.info(
            "Starting worker %s (polling every %ss)",
            self.worker_id,
            self.poll_interval,
        )

        while self.running:
            try:
                jobs = await self.queue.claim(
                    worker_id=self.worker_id,
                    visibility_timeout_sec=self.visibility_timeout,
                    limit=1,
                )

                if not jobs:
                    with contextlib.suppress(TimeoutError):
                        await asyncio.wait_for(
                            self._stop_event.wait(),
                            timeout=self.poll_interval,
                        )
                    continue

                for job in jobs:
                    await self._process_job(job)

            except Exception as exc:
                logger.exception("Error in worker polling loop: %s", exc)
                await asyncio.sleep(self.poll_interval)

        logger.info("Worker %s has stopped.", self.worker_id)

    async def _process_job(self, job) -> None:
        """Dispatches job to registered handler and completes or fails the job."""
        handler = self.registry.get(job.kind)
        if not handler:
            logger.error("No handler registered for job kind '%s'", job.kind)
            await self.queue.fail(job.id, f"No handler registered for kind: {job.kind}")
            return

        logger.info(
            "Processing job %s (kind=%s, attempt=%d)",
            job.id,
            job.kind,
            job.attempts,
        )
        try:
            await handler(job)
            await self.queue.complete(job.id)
            logger.info("Successfully completed job %s", job.id)
        except Exception as exc:
            logger.exception("Job %s failed with error: %s", job.id, exc)
            await self.queue.fail(job.id, str(exc))

    def stop(self) -> None:
        """Signals the worker to stop gracefully."""
        self.running = False
        self._stop_event.set()


def setup_signal_handlers(worker: QueueWorker, loop: asyncio.AbstractEventLoop) -> None:
    """Registers SIGTERM and SIGINT signal handlers for graceful shutdown."""
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, worker.stop)
        except NotImplementedError:
            # Windows does not support add_signal_handler in standard loop
            signal.signal(sig, lambda *_: worker.stop())


async def main() -> None:
    """CLI worker entrypoint."""
    setup_logging(level=logging.INFO)
    worker = QueueWorker()
    loop = asyncio.get_running_loop()
    setup_signal_handlers(worker, loop)
    await worker.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)
