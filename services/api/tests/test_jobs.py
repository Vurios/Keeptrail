"""Acceptance tests for Prompt 4: Job Queue and Worker."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from katibay_api.jobs.queue import InMemoryJobQueue
from katibay_api.jobs.registry import HandlerRegistry
from katibay_api.worker import QueueWorker


@pytest.mark.asyncio
async def test_enqueue_and_claim_single_job():
    """Enqueueing creates a pending job; claiming transitions it to claimed."""
    queue = InMemoryJobQueue()
    job = await queue.enqueue(
        kind="extract_receipt",
        payload={"receipt_id": "123", "workspace_id": "456"},
    )
    assert job.status == "pending"
    assert job.attempts == 0

    claimed_jobs = await queue.claim(worker_id="worker-1", visibility_timeout_sec=30)
    assert len(claimed_jobs) == 1
    claimed = claimed_jobs[0]
    assert claimed.id == job.id
    assert claimed.status == "claimed"
    assert claimed.attempts == 1
    assert claimed.locked_by == "worker-1"


@pytest.mark.asyncio
async def test_concurrent_claiming_by_two_workers_no_double_processing():
    """Acceptance Criteria:

    Concurrent claiming by two workers processes all jobs with zero double-processing.
    """
    queue = InMemoryJobQueue()
    num_jobs = 20

    # Enqueue 20 jobs
    for i in range(num_jobs):
        await queue.enqueue(
            kind="extract_receipt",
            payload={"index": i},
        )

    claimed_by_w1 = []
    claimed_by_w2 = []

    async def worker_claim_loop(worker_id: str, dest_list: list):
        for _ in range(num_jobs):
            claimed = await queue.claim(worker_id=worker_id, limit=1)
            if claimed:
                dest_list.extend(claimed)
            await asyncio.sleep(0.001)

    # Run two workers concurrently
    await asyncio.gather(
        worker_claim_loop("worker-1", claimed_by_w1),
        worker_claim_loop("worker-2", claimed_by_w2),
    )

    all_claimed_ids = [j.id for j in claimed_by_w1] + [j.id for j in claimed_by_w2]
    unique_claimed_ids = set(all_claimed_ids)

    assert len(all_claimed_ids) == num_jobs
    assert len(unique_claimed_ids) == num_jobs
    assert len(claimed_by_w1) > 0
    assert len(claimed_by_w2) > 0


@pytest.mark.asyncio
async def test_job_retry_exponential_backoff():
    """Acceptance Criteria:

    Failing a job schedules retry with exponential backoff.
    """
    queue = InMemoryJobQueue()
    await queue.enqueue(kind="extract_receipt", payload={})

    # First claim (attempt 1)
    claimed = (await queue.claim(worker_id="worker-1"))[0]
    before_fail = datetime.now(UTC)

    # Fail attempt 1 (backoff_base = 2 -> 2^1 = 2 seconds)
    await queue.fail(
        job_id=claimed.id,
        error="Transient network timeout",
        backoff_base=2.0,
    )

    failed_job = queue.jobs[claimed.id]
    assert failed_job.status == "pending"
    assert failed_job.last_error == "Transient network timeout"
    assert failed_job.run_after >= before_fail + timedelta(seconds=1.5)

    # Immediate claim should find no eligible jobs (run_after in future)
    immediate_claim = await queue.claim(worker_id="worker-1")
    assert len(immediate_claim) == 0


@pytest.mark.asyncio
async def test_job_dead_lettering_after_max_attempts():
    """Acceptance Criteria:

    After 5 failed attempts, job enters 'dead' status and is not claimed.
    """
    queue = InMemoryJobQueue()
    job = await queue.enqueue(kind="extract_receipt", payload={})

    for attempt in range(1, 6):
        queue.jobs[job.id].run_after = datetime.now(UTC) - timedelta(seconds=1)

        claimed = (await queue.claim(worker_id="worker-1"))[0]
        assert claimed.attempts == attempt

        await queue.fail(
            job_id=claimed.id,
            error=f"Failure #{attempt}",
            max_attempts=5,
        )

    dead_job = queue.jobs[job.id]
    assert dead_job.status == "dead"
    assert dead_job.attempts == 5
    assert dead_job.last_error == "Failure #5"

    dead_job.run_after = datetime.now(UTC) - timedelta(seconds=10)
    claims_after_dead = await queue.claim(worker_id="worker-1")
    assert len(claims_after_dead) == 0


@pytest.mark.asyncio
async def test_worker_handler_execution_and_graceful_shutdown():
    """Worker claims, executes handler from registry, and shuts down."""
    queue = InMemoryJobQueue()
    registry = HandlerRegistry()

    processed_payloads = []

    async def mock_extract_handler(job):
        processed_payloads.append(job.payload)

    registry.register("extract_receipt", mock_extract_handler)

    await queue.enqueue(
        kind="extract_receipt",
        payload={"receipt_id": "test-receipt-1"},
    )

    worker = QueueWorker(
        worker_id="test-worker",
        queue=queue,
        registry=registry,
        poll_interval_sec=0.01,
    )

    worker_task = asyncio.create_task(worker.run())
    await asyncio.sleep(0.05)
    worker.stop()
    await worker_task

    assert len(processed_payloads) == 1
    assert processed_payloads[0]["receipt_id"] == "test-receipt-1"
    assert list(queue.jobs.values())[0].status == "completed"
