"""Acceptance tests for Prompt 9: Exception Resolution and Approval."""

import uuid

import pytest
from fastapi.testclient import TestClient

from katibay_api.db import (
    ExceptionRecord,
    InMemoryRepository,
    ReceiptRecord,
    set_db_repository,
)
from katibay_api.main import app
from tests.test_auth_and_middleware import generate_jwt

client = TestClient(app)


@pytest.fixture
def test_setup():
    """Sets up mock state with activity, receipt, and exception."""
    mock_db = InMemoryRepository()
    set_db_repository(mock_db)

    user_id = uuid.uuid4()
    treasurer_id = uuid.uuid4()
    member_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    activity_id = uuid.uuid4()
    receipt_id = uuid.uuid4()
    exception_id = uuid.uuid4()

    # Seed activity
    mock_db.activities.append(
        {
            "id": activity_id,
            "workspace_id": workspace_id,
            "title": "Freshman Welcome 2026",
            "start_date": "2026-08-01",
            "end_date": "2026-08-31",
            "cash_advance_amount": 1000000,
            "status": "collecting",
        }
    )

    # Seed budget lines
    mock_db.budget_lines.append(
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "category": "Food & Catering",
            "approved_amount": 500000,
        }
    )

    # Seed receipt with mismatch
    receipt = ReceiptRecord(
        id=receipt_id,
        workspace_id=workspace_id,
        activity_id=activity_id,
        uploaded_by=user_id,
        storage_path="receipts/test.jpg",
        sha256="a" * 64,
        perceptual_hash="0" * 16,
        status="exception",
        created_at=None,
        updated_at=None,
    )
    receipt.merchant_name = "Jollibee Katipunan"
    receipt.or_number = "OR-98765"
    receipt.txn_date = "2026-08-15"
    receipt.subtotal = 50000  # ₱500.00
    receipt.vat_amount = 6000  # ₱60.00
    receipt.total_amount = 58000  # Mismatched total: ₱580.00 vs ₱560.00
    receipt.category = "Food & Catering"
    receipt.confidence = 0.95
    mock_db.receipts.append(receipt)

    # Seed blocking exception
    exc = ExceptionRecord(
        id=exception_id,
        receipt_id=receipt_id,
        activity_id=activity_id,
        kind="arith_mismatch",
        severity="blocking",
        question_text=("Total ₱580.00 does not match subtotal + VAT (₱560.00)."),
        suggested_values={"expected_total": 56000, "extracted_total": 58000},
        status="open",
        created_at=None,
        updated_at=None,
    )
    mock_db.exceptions.append(exc)

    tokens = {
        "treasurer": generate_jwt(
            user_id=treasurer_id,
            memberships={str(workspace_id): "treasurer"},
        ),
        "owner": generate_jwt(
            user_id=user_id,
            memberships={str(workspace_id): "owner"},
        ),
        "member": generate_jwt(
            user_id=member_id,
            memberships={str(workspace_id): "member"},
        ),
        "auditor": generate_jwt(
            user_id=uuid.uuid4(),
            memberships={str(workspace_id): "auditor"},
        ),
    }

    return {
        "db": mock_db,
        "workspace_id": workspace_id,
        "activity_id": activity_id,
        "receipt_id": receipt_id,
        "exception_id": exception_id,
        "tokens": tokens,
    }


# ===========================================================================
# 1. Exception Resolution Tests
# ===========================================================================


def test_resolve_exception_with_correction(test_setup):
    """Acceptance: Resolving exception with corrected total updates receipt."""
    exc_id = test_setup["exception_id"]
    token = test_setup["tokens"]["treasurer"]
    db = test_setup["db"]

    response = client.post(
        f"/exceptions/{exc_id}/resolve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "action": "resolve",
            "correction": {"total_amount": 56000},  # Corrected to match 500+60
            "reason": "Corrected transcribed typo from 580 to 560.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["exception"]["status"] == "resolved"
    assert data["reverification"]["passed"] is True
    assert data["reverification"]["remaining_exceptions"] == 0

    # Receipt status updated to verified
    receipt = next(r for r in db.receipts if r.id == test_setup["receipt_id"])
    assert receipt.status == "verified"
    assert receipt.total_amount == 56000

    # Audit event logged
    audit = next(a for a in db.audit_events if a.entity_type == "exceptions")
    assert audit.action == "exception_resolved"
    assert audit.after["status"] == "resolved"


def test_resolve_exception_with_waiver_and_reason(test_setup):
    """Acceptance: Waiving exception with reason succeeds and logs audit."""
    exc_id = test_setup["exception_id"]
    token = test_setup["tokens"]["treasurer"]
    db = test_setup["db"]

    response = client.post(
        f"/exceptions/{exc_id}/resolve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "action": "waive",
            "reason": "Official merchant discount applied on total.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["exception"]["status"] == "waived"
    assert (
        data["exception"]["resolution_note"]
        == "Official merchant discount applied on total."
    )

    # Audit event logged
    audit = next(a for a in db.audit_events if a.entity_type == "exceptions")
    assert audit.action == "exception_waived"


def test_resolve_exception_with_waiver_without_reason_rejected(test_setup):
    """Acceptance: Waiving exception without reason is rejected with HTTP 422."""
    exc_id = test_setup["exception_id"]
    token = test_setup["tokens"]["treasurer"]

    response = client.post(
        f"/exceptions/{exc_id}/resolve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "action": "waive",
            "reason": "",  # Empty reason
        },
    )

    assert response.status_code == 422


# ===========================================================================
# 2. Receipt Approval & Role Enforcement Tests
# ===========================================================================


def test_approve_receipt_role_enforcement(test_setup):
    """Acceptance: Only treasurer or owner can approve receipt into ledger."""
    receipt_id = test_setup["receipt_id"]
    db = test_setup["db"]

    # 1. Try with regular member -> 403 Forbidden
    member_resp = client.post(
        f"/receipts/{receipt_id}/approve",
        headers={"Authorization": f"Bearer {test_setup['tokens']['member']}"},
    )
    assert member_resp.status_code == 403

    # 2. Try with auditor -> 403 Forbidden
    auditor_resp = client.post(
        f"/receipts/{receipt_id}/approve",
        headers={"Authorization": f"Bearer {test_setup['tokens']['auditor']}"},
    )
    assert auditor_resp.status_code == 403

    # 3. Resolve blocking exception first
    client.post(
        f"/exceptions/{test_setup['exception_id']}/resolve",
        headers={"Authorization": f"Bearer {test_setup['tokens']['treasurer']}"},
        json={"action": "waive", "reason": "Approved by treasurer."},
    )

    # 4. Try with treasurer -> 200 OK
    treasurer_resp = client.post(
        f"/receipts/{receipt_id}/approve",
        headers={"Authorization": f"Bearer {test_setup['tokens']['treasurer']}"},
    )
    assert treasurer_resp.status_code == 200
    data = treasurer_resp.json()
    assert data["receipt"]["status"] == "approved"
    assert data["ledger_entry"]["amount"] == 58000
    assert len(db.ledger_entries) == 1

    # Audit event logged for approval
    audit = next(a for a in db.audit_events if a.action == "receipt_approved")
    assert audit.entity_id == receipt_id


# ===========================================================================
# 3. Blocked Activity Closure Tests
# ===========================================================================


def test_blocked_activity_closure_with_open_exceptions(test_setup):
    """Acceptance: Activity cannot close while open blocking exceptions remain."""
    activity_id = test_setup["activity_id"]
    token = test_setup["tokens"]["treasurer"]

    # 1. Attempt close while blocking exception is open -> 409 Conflict
    response = client.post(
        f"/activities/{activity_id}/close",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409

    # 2. Waive the blocking exception
    client.post(
        f"/exceptions/{test_setup['exception_id']}/resolve",
        headers={"Authorization": f"Bearer {token}"},
        json={"action": "waive", "reason": "Waived for activity close."},
    )

    # 3. Attempt close again -> 200 OK
    close_resp = client.post(
        f"/activities/{activity_id}/close",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "closed"


def test_get_activity_exceptions_filtering(test_setup):
    """Acceptance: GET /activities/{id}/exceptions supports filtering."""
    activity_id = test_setup["activity_id"]
    token = test_setup["tokens"]["member"]

    # Query with filters
    response = client.get(
        f"/activities/{activity_id}/exceptions"
        f"?kind=arith_mismatch&severity=blocking&status=open",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["kind"] == "arith_mismatch"

    # Query with non-matching filter
    empty_resp = client.get(
        f"/activities/{activity_id}/exceptions?status=resolved",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert empty_resp.status_code == 200
    assert len(empty_resp.json()) == 0
