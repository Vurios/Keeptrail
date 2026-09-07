"""Tests for Audit Trail, Rate Limiting, 60s Signed URLs, and Telemetry Metrics."""

import io
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from katibay_api.db import InMemoryRepository, set_db_repository
from katibay_api.main import app
from katibay_api.metrics import metrics_collector
from katibay_api.ratelimit import upload_rate_limiter
from katibay_api.storage import InMemoryStorageClient, set_storage_client
from tests.helpers import create_synthetic_receipt
from tests.test_auth_and_middleware import generate_jwt


@pytest.fixture(autouse=True)
def clean_rate_limiter():
    upload_rate_limiter.reset()
    upload_rate_limiter.max_requests = 60
    yield
    upload_rate_limiter.reset()
    upload_rate_limiter.max_requests = 60


@pytest.fixture
def test_repo() -> InMemoryRepository:
    repo = InMemoryRepository()
    set_db_repository(repo)
    return repo


@pytest.fixture
def test_storage() -> InMemoryStorageClient:
    storage = InMemoryStorageClient()
    set_storage_client(storage)
    return storage


@pytest.fixture
def client(
    test_repo: InMemoryRepository, test_storage: InMemoryStorageClient
) -> TestClient:
    return TestClient(app)


def test_activity_audit_trail_endpoint(
    client: TestClient, test_repo: InMemoryRepository
) -> None:
    workspace_id = uuid.uuid4()
    activity_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Prepopulate activity
    activity_record = {
        "id": activity_id,
        "workspace_id": workspace_id,
        "title": "Leadership Summit 2026",
        "start_date": "2026-08-10",
        "end_date": "2026-08-12",
        "cash_advance_amount": 3000000,
        "status": "collecting",
    }
    test_repo.activities.append(activity_record)

    # Insert chronological audit event
    now = datetime.now(UTC)
    test_repo.audit_events.append(
        type(
            "AuditEvent",
            (),
            {
                "id": uuid.uuid4(),
                "workspace_id": workspace_id,
                "actor_id": user_id,
                "entity_type": "activities",
                "entity_id": activity_id,
                "action": "activity_created",
                "before": None,
                "after": {"status": "collecting", "title": "Leadership Summit 2026"},
                "occurred_at": now,
            },
        )()
    )

    token = generate_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(f"/activities/{activity_id}/audit", headers=headers)
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    assert events[0]["action"] == "activity_created"
    assert events[0]["entity_type"] == "activities"
    assert events[0]["after"]["title"] == "Leadership Summit 2026"


def test_receipt_signed_url_with_60s_expiry(
    client: TestClient,
    test_repo: InMemoryRepository,
    test_storage: InMemoryStorageClient,
) -> None:
    workspace_id = uuid.uuid4()
    receipt_id = uuid.uuid4()
    user_id = uuid.uuid4()

    receipt_record = type(
        "ReceiptRecord",
        (),
        {
            "id": receipt_id,
            "workspace_id": workspace_id,
            "storage_path": "receipts/summit-lunch.jpg",
            "merchant_name": "Jollibee Philam",
            "total_amount": 150000,
            "status": "verified",
        },
    )()
    test_repo.receipts.append(receipt_record)

    token = generate_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(f"/receipts/{receipt_id}/signed-url", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["receipt_id"] == str(receipt_id)
    assert data["expires_in_seconds"] == 60
    assert "token=mock-signed-60s" in data["signed_url"]


def test_upload_rate_limiter_exceeded(
    client: TestClient, test_repo: InMemoryRepository
) -> None:
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    token = generate_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    upload_rate_limiter.reset()
    upload_rate_limiter.max_requests = 3  # Lower threshold for this specific test

    file_content = create_synthetic_receipt("SAMPLE RECEIPT\nPHP 100.00")

    for i in range(3):
        res = client.post(
            f"/workspaces/{workspace_id}/receipts",
            files=[
                (
                    "files",
                    (f"test_{i}.jpg", io.BytesIO(file_content), "image/jpeg"),
                )
            ],
            headers=headers,
        )
        assert res.status_code == 201

    # 4th request should trigger 429 Too Many Requests
    blocked_res = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[
            (
                "files",
                ("test_blocked.jpg", io.BytesIO(file_content), "image/jpeg"),
            )
        ],
        headers=headers,
    )
    assert blocked_res.status_code == 429
    assert "Rate limit exceeded" in blocked_res.json()["detail"]
    assert "retry-after" in blocked_res.headers


def test_metrics_endpoint_json_and_prometheus(
    client: TestClient, test_repo: InMemoryRepository
) -> None:
    metrics_collector.record_extraction_latency(350.0)
    metrics_collector.record_extraction_latency(450.0)

    # 1. JSON format
    json_res = client.get("/metrics?format=json")
    assert json_res.status_code == 200
    json_data = json_res.json()
    assert "job_queue_depth" in json_data
    assert "extraction_latency_p50_ms" in json_data
    assert "extraction_latency_p95_ms" in json_data
    assert "exception_rate" in json_data
    assert json_data["status"] == "healthy"

    # 2. Prometheus format
    prom_res = client.get("/metrics?format=prometheus")
    assert prom_res.status_code == 200
    assert "text/plain" in prom_res.headers["content-type"]
    prom_text = prom_res.text
    assert "katibay_job_queue_depth" in prom_text
    assert "katibay_extraction_latency_p50_ms" in prom_text
    assert "katibay_exception_rate" in prom_text
