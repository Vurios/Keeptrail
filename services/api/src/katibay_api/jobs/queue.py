"""Postgres-backed Job Queue with FOR UPDATE SKIP LOCKED claiming."""

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import asyncpg

from katibay_api.config import settings


@dataclass
class Job:
    """Represents a job record in the queue."""

    id: uuid.UUID
    kind: str
    payload: dict[str, Any]
    status: str
    attempts: int
    locked_at: datetime | None
    locked_by: str | None
    run_after: datetime
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class JobQueue(Protocol):
    """Protocol for job queue operations."""

    async def enqueue(
        self,
        kind: str,
        payload: dict[str, Any],
        run_after: datetime | None = None,
    ) -> Job: ...

    async def claim(
        self,
        worker_id: str,
        visibility_timeout_sec: int = 60,
        limit: int = 1,
    ) -> list[Job]: ...

    async def complete(self, job_id: uuid.UUID) -> None: ...

    async def fail(
        self,
        job_id: uuid.UUID,
        error: str,
        max_attempts: int = 5,
        backoff_base: float = 2.0,
    ) -> None: ...


class PostgresJobQueue:
    """Postgres-backed job queue utilizing SELECT FOR UPDATE SKIP LOCKED."""

    def __init__(self, dsn: str = settings.supabase_db_url) -> None:
        self.dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self.dsn)
        return self._pool

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def enqueue(
        self,
        kind: str,
        payload: dict[str, Any],
        run_after: datetime | None = None,
    ) -> Job:
        pool = await self.get_pool()
        now = datetime.now(UTC)
        target_run_after = run_after or now

        row = await pool.fetchrow(
            """
            INSERT INTO public.jobs (kind, payload, status, attempts, run_after)
            VALUES ($1, $2, 'pending', 0, $3)
            RETURNING id, kind, payload, status::text, attempts, locked_at,
                      locked_by, run_after, last_error, created_at, updated_at
            """,
            kind,
            json.dumps(payload),
            target_run_after,
        )
        return self._row_to_job(row)

    async def claim(
        self,
        worker_id: str,
        visibility_timeout_sec: int = 60,
        limit: int = 1,
    ) -> list[Job]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            WITH candidate_jobs AS (
                SELECT id
                FROM public.jobs
                WHERE (
                    status = 'pending'
                    OR (status = 'claimed' AND run_after <= now())
                )
                  AND run_after <= now()


                ORDER BY run_after ASC, created_at ASC
                LIMIT $3
                FOR UPDATE SKIP LOCKED
            )
            UPDATE public.jobs j
            SET status = 'claimed',
                locked_at = now(),
                locked_by = $1,
                attempts = j.attempts + 1,
                run_after = now() + make_interval(secs => $2::int)
            FROM candidate_jobs c
            WHERE j.id = c.id
            RETURNING j.id, j.kind, j.payload, j.status::text, j.attempts,
                      j.locked_at, j.locked_by, j.run_after, j.last_error,
                      j.created_at, j.updated_at
            """,
            worker_id,
            visibility_timeout_sec,
            limit,
        )
        return [self._row_to_job(r) for r in rows]

    async def complete(self, job_id: uuid.UUID) -> None:
        pool = await self.get_pool()
        await pool.execute(
            """
            UPDATE public.jobs
            SET status = 'completed',
                locked_at = NULL,
                locked_by = NULL
            WHERE id = $1
            """,
            job_id,
        )

    async def fail(
        self,
        job_id: uuid.UUID,
        error: str,
        max_attempts: int = 5,
        backoff_base: float = 2.0,
    ) -> None:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT attempts FROM public.jobs WHERE id = $1", job_id
            )
            if not row:
                return
            attempts = row["attempts"]
            if attempts >= max_attempts:
                await conn.execute(
                    """
                    UPDATE public.jobs
                    SET status = 'dead',
                        locked_at = NULL,
                        locked_by = NULL,
                        last_error = $2
                    WHERE id = $1
                    """,
                    job_id,
                    error,
                )
            else:
                backoff_delay = backoff_base**attempts
                await conn.execute(
                    """
                    UPDATE public.jobs
                    SET status = 'pending',
                        locked_at = NULL,
                        locked_by = NULL,
                        run_after = now() + make_interval(secs => $2::int),
                        last_error = $3
                    WHERE id = $1
                    """,
                    job_id,
                    int(backoff_delay),
                    error,
                )

    def _row_to_job(self, row: Any) -> Job:
        payload = row["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        return Job(
            id=row["id"],
            kind=row["kind"],
            payload=payload,
            status=row["status"],
            attempts=row["attempts"],
            locked_at=row["locked_at"],
            locked_by=row["locked_by"],
            run_after=row["run_after"],
            last_error=row["last_error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class InMemoryJobQueue:
    """Thread-safe and async-safe in-memory job queue for tests."""

    def __init__(self) -> None:
        self.jobs: dict[uuid.UUID, Job] = {}
        self._lock = asyncio.Lock()

    async def enqueue(
        self,
        kind: str,
        payload: dict[str, Any],
        run_after: datetime | None = None,
    ) -> Job:
        async with self._lock:
            now = datetime.now(UTC)
            target_run_after = run_after or now
            job_id = uuid.uuid4()
            job = Job(
                id=job_id,
                kind=kind,
                payload=payload,
                status="pending",
                attempts=0,
                locked_at=None,
                locked_by=None,
                run_after=target_run_after,
                last_error=None,
                created_at=now,
                updated_at=now,
            )
            self.jobs[job_id] = job
            return job

    async def claim(
        self,
        worker_id: str,
        visibility_timeout_sec: int = 60,
        limit: int = 1,
    ) -> list[Job]:
        async with self._lock:
            now = datetime.now(UTC)
            eligible: list[Job] = []

            for job in sorted(
                self.jobs.values(), key=lambda j: (j.run_after, j.created_at)
            ):
                if len(eligible) >= limit:
                    break
                is_pending = job.status == "pending" and job.run_after <= now
                is_expired_claim = job.status == "claimed" and job.run_after <= now

                if is_pending or is_expired_claim:
                    job.status = "claimed"
                    job.locked_at = now
                    job.locked_by = worker_id
                    job.attempts += 1
                    job.run_after = now + timedelta(seconds=visibility_timeout_sec)
                    job.updated_at = now
                    eligible.append(job)

            return eligible

    async def complete(self, job_id: uuid.UUID) -> None:
        async with self._lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = "completed"
                job.locked_at = None
                job.locked_by = None
                job.updated_at = datetime.now(UTC)

    async def fail(
        self,
        job_id: uuid.UUID,
        error: str,
        max_attempts: int = 5,
        backoff_base: float = 2.0,
    ) -> None:
        async with self._lock:
            if job_id not in self.jobs:
                return
            job = self.jobs[job_id]
            now = datetime.now(UTC)
            job.last_error = error
            job.locked_at = None
            job.locked_by = None
            job.updated_at = now

            if job.attempts >= max_attempts:
                job.status = "dead"
            else:
                backoff_secs = backoff_base**job.attempts
                job.status = "pending"
                job.run_after = now + timedelta(seconds=backoff_secs)


_default_queue: JobQueue = InMemoryJobQueue()


def get_job_queue() -> JobQueue:
    return _default_queue


def set_job_queue(queue: JobQueue) -> None:
    global _default_queue
    _default_queue = queue
