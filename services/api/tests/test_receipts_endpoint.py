"""Acceptance and integration tests for POST /workspaces/{id}/receipts."""

import io
import uuid

import pytest
from fastapi.testclient import TestClient

from katibay_api.config import settings
from katibay_api.db import InMemoryRepository, set_db_repository
from katibay_api.main import app
from katibay_api.storage import InMemoryStorageClient, set_storage_client
from tests.helpers import create_synthetic_pdf, create_synthetic_receipt

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Configures in-memory database and storage for each test."""
    repo = InMemoryRepository()
    storage = InMemoryStorageClient()
    set_db_repository(repo)
    set_storage_client(storage)
    yield repo, storage


def test_health_endpoint():
    """Verifies health check responds."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_upload_single_receipt_success(setup_test_environment):
    """Uploading a new receipt creates the row, storage file, and job."""
    repo, storage = setup_test_environment
    workspace_id = uuid.uuid4()
    receipt_bytes = create_synthetic_receipt("SHELL GAS STATION\nDIESEL: PHP 2500.00")

    response = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[("files", ("receipt.jpg", io.BytesIO(receipt_bytes), "image/jpeg"))],
    )

    assert response.status_code == 201
    data = response.json()
    assert data["workspace_id"] == str(workspace_id)
    assert data["processed_count"] == 1

    item = data["items"][0]
    assert item["status"] == "queued"
    assert item["is_duplicate"] is False
    assert item["job_enqueued"] is True
    assert item["exception_id"] is None
    assert len(item["sha256"]) == 64
    assert len(item["perceptual_hash"]) == 16

    # Verify repository state
    assert len(repo.receipts) == 1
    assert len(repo.jobs) == 1
    assert repo.jobs[0].kind == "extract_receipt"
    assert len(repo.exceptions) == 0
    assert len(repo.audit_events) == 1
    assert repo.audit_events[0].action == "receipt_uploaded"

    # Verify storage state
    bucket = settings.supabase_storage_bucket_receipts
    storage_key = f"{bucket}/{workspace_id}/{item['receipt_id']}.jpg"
    assert storage_key in storage.files


def test_upload_exact_duplicate_creates_one_job_and_one_exception(
    setup_test_environment,
):
    """Acceptance Criteria:

    Uploading the same file twice produces one extraction job and one
    duplicate exception.
    """
    repo, storage = setup_test_environment
    workspace_id = uuid.uuid4()
    receipt_bytes = create_synthetic_receipt(
        "NATIONAL BOOK STORE\nPEN: PHP 45.00\nNOTEBOOK: PHP 90.00"
    )

    # 1. First upload
    res1 = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[
            (
                "files",
                ("receipt_1.jpg", io.BytesIO(receipt_bytes), "image/jpeg"),
            )
        ],
    )
    assert res1.status_code == 201
    item1 = res1.json()["items"][0]
    assert item1["status"] == "queued"
    assert item1["is_duplicate"] is False
    assert item1["job_enqueued"] is True

    assert len(repo.receipts) == 1
    assert len(repo.jobs) == 1
    assert len(repo.exceptions) == 0

    # 2. Second upload (exact same file)
    res2 = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[
            (
                "files",
                ("receipt_copy.jpg", io.BytesIO(receipt_bytes), "image/jpeg"),
            )
        ],
    )
    assert res2.status_code == 201
    item2 = res2.json()["items"][0]
    assert item2["is_duplicate"] is True
    assert item2["job_enqueued"] is False
    assert item2["exception_id"] is not None
    assert item2["matched_receipt_id"] == item1["receipt_id"]
    assert item2["match_type"] == "sha256"

    # Exactly 2 receipts created, 1 job enqueued total, 1 duplicate exception
    assert len(repo.receipts) == 2
    assert len(repo.jobs) == 1
    assert len(repo.exceptions) == 1
    assert repo.exceptions[0].kind == "duplicate"
    assert repo.exceptions[0].severity == "blocking"


def test_rotated_rephotograph_caught_as_duplicate_exception(
    setup_test_environment,
):
    """Acceptance Criteria:

    A rotated re-photograph of the same receipt is also caught as a duplicate
    exception.
    """
    repo, storage = setup_test_environment
    workspace_id = uuid.uuid4()
    text = "GRAB TAXI PH\nFARE: PHP 340.00\nTOLL: PHP 45.00"

    original_bytes = create_synthetic_receipt(text=text, rotation_angle_deg=0.0)
    rotated_bytes = create_synthetic_receipt(
        text=text, rotation_angle_deg=4.0, contrast_offset=-15
    )

    # 1. Upload original receipt
    res1 = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[("files", ("grab_orig.jpg", io.BytesIO(original_bytes), "image/jpeg"))],
    )
    assert res1.status_code == 201
    item1 = res1.json()["items"][0]
    assert item1["is_duplicate"] is False
    assert item1["job_enqueued"] is True

    # 2. Upload rotated re-photograph
    res2 = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[
            (
                "files",
                ("grab_rotated.jpg", io.BytesIO(rotated_bytes), "image/jpeg"),
            )
        ],
    )
    assert res2.status_code == 201
    item2 = res2.json()["items"][0]
    assert item2["is_duplicate"] is True
    assert item2["job_enqueued"] is False
    assert item2["exception_id"] is not None
    assert item2["matched_receipt_id"] == item1["receipt_id"]
    assert item2["match_type"] == "phash"
    assert item2["hamming_distance"] <= 5

    # Exactly 2 receipts, 1 job, 1 duplicate exception
    assert len(repo.receipts) == 2
    assert len(repo.jobs) == 1
    assert len(repo.exceptions) == 1


def test_upload_multiple_files_in_batch(setup_test_environment):
    """Uploads multiple files at once."""
    repo, storage = setup_test_environment
    workspace_id = uuid.uuid4()

    file1 = create_synthetic_receipt(
        "ACE HARDWARE PH\n"
        "HAMMER: PHP 450.00\n"
        "NAILS: PHP 50.00\n"
        "PAINT: PHP 800.00\n"
        "TOTAL: PHP 1300.00"
    )
    file2 = create_synthetic_receipt(
        "STARBUCKS COFFEE\n"
        "LATTE: PHP 195.00\n"
        "CROISSANT: PHP 135.00\n"
        "TOTAL: PHP 330.00"
    )
    file3_pdf = create_synthetic_pdf()

    response = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[
            ("files", ("receipt1.jpg", io.BytesIO(file1), "image/jpeg")),
            ("files", ("receipt2.png", io.BytesIO(file2), "image/png")),
            ("files", ("receipt3.pdf", io.BytesIO(file3_pdf), "application/pdf")),
        ],
    )

    assert response.status_code == 201
    data = response.json()
    assert data["processed_count"] == 3
    assert len(repo.receipts) == 3
    assert len(repo.jobs) == 3


def test_upload_file_exceeding_10mb_rejected():
    """Rejects files larger than 10 MB with 413 Payload Too Large."""
    workspace_id = uuid.uuid4()
    huge_bytes = b"0" * (10 * 1024 * 1024 + 1024)  # 10 MB + 1 KB

    response = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[("files", ("huge_receipt.jpg", io.BytesIO(huge_bytes), "image/jpeg"))],
    )

    assert response.status_code == 413
    assert "exceeds the maximum allowed size" in response.json()["detail"]


def test_upload_unsupported_file_type_rejected():
    """Rejects unsupported file formats with 422 Unprocessable Entity."""
    workspace_id = uuid.uuid4()
    txt_bytes = b"Hello, this is just plain text, not a receipt image."

    response = client.post(
        f"/workspaces/{workspace_id}/receipts",
        files=[("files", ("notes.txt", io.BytesIO(txt_bytes), "text/plain"))],
    )

    assert response.status_code == 422
    assert "Unsupported file format" in response.json()["detail"]


def test_duplicates_isolated_by_workspace(setup_test_environment):
    """Receipts in workspace A do not cause duplicate exceptions in workspace B."""
    repo, storage = setup_test_environment
    workspace_a = uuid.uuid4()
    workspace_b = uuid.uuid4()

    receipt_bytes = create_synthetic_receipt("COMMON VENDOR\nPHP 500")

    # Upload to Workspace A
    res_a = client.post(
        f"/workspaces/{workspace_a}/receipts",
        files=[("files", ("rec.jpg", io.BytesIO(receipt_bytes), "image/jpeg"))],
    )
    assert res_a.status_code == 201
    assert res_a.json()["items"][0]["is_duplicate"] is False

    # Upload same receipt to Workspace B
    res_b = client.post(
        f"/workspaces/{workspace_b}/receipts",
        files=[("files", ("rec.jpg", io.BytesIO(receipt_bytes), "image/jpeg"))],
    )
    assert res_b.status_code == 201
    # Should NOT be duplicate because it's a different workspace
    assert res_b.json()["items"][0]["is_duplicate"] is False
    assert len(repo.jobs) == 2
    assert len(repo.exceptions) == 0
