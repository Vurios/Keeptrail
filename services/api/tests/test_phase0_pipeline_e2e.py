"""Phase 0 End-to-End Pipeline Integration Test (75 receipts dataset).

Runs the full pipeline:
INTAKE -> EXTRACT -> VERIFY -> CLASSIFY -> RECONCILE -> EXCEPTION -> EXPORT -> SEAL.
"""

import uuid
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from katibay_api.classification.models import MerchantRule
from katibay_api.classification.service import classify_merchant
from katibay_api.db import (
    ExceptionRecord,
    InMemoryRepository,
    ReceiptRecord,
    set_db_repository,
)
from katibay_api.extraction.schemas import ExtractedLineItem, ReceiptExtraction
from katibay_api.main import app
from katibay_api.reports.packet import build_evidence_packet
from katibay_api.storage import InMemoryStorageClient, set_storage_client
from katibay_api.verification import ActivityContext, verify_receipt
from tests.test_auth_and_middleware import generate_jwt


@pytest.fixture
def setup_phase0_environment():
    repo = InMemoryRepository()
    storage = InMemoryStorageClient()
    set_db_repository(repo)
    set_storage_client(storage)
    return repo, storage


@pytest.mark.asyncio
async def test_phase0_75_receipts_full_pipeline(setup_phase0_environment) -> None:
    repo, storage = setup_phase0_environment
    client = TestClient(app)

    workspace_id = uuid.uuid4()
    activity_id = uuid.uuid4()
    treasurer_id = uuid.uuid4()
    token = generate_jwt(
        user_id=treasurer_id,
        memberships={str(workspace_id): "treasurer"},
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initialize Activity & Budget Lines
    repo.activities.append(
        {
            "id": activity_id,
            "workspace_id": workspace_id,
            "title": "Phase 0 Full Organization Liquidations 2026",
            "start_date": "2026-08-01",
            "end_date": "2026-08-31",
            "cash_advance_amount": 50000000,  # ₱500,000.00
            "status": "collecting",
        }
    )

    budget_lines = [
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "category": "Food & Catering",
            "approved_amount": 20000000,
        },
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "category": "Office Supplies",
            "approved_amount": 10000000,
        },
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "category": "Logistics & Transport",
            "approved_amount": 10000000,
        },
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "category": "Equipment & Rental",
            "approved_amount": 10000000,
        },
    ]
    repo.budget_lines.extend(budget_lines)

    merchant_rules = [
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern="National Book Store",
            category="Office Supplies",
        ),
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern="Jollibee Food Corp",
            category="Food & Catering",
        ),
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern="Silicon Valley Supplies",
            category="Office Supplies",
        ),
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern="Lalamove Logistics",
            category="Logistics & Transport",
        ),
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern="Corner Convenience",
            category="Office Supplies",
        ),
    ]

    counts = {
        "total": 75,
        "auto_approved": 0,
        "soft_flagged": 0,
        "exceptions": 0,
        "resolved_exceptions": 0,
        "approved_to_ledger": 0,
    }

    approved_receipt_ids = []
    context = ActivityContext(
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 31),
        today=date(2026, 9, 1),
    )
    now = datetime.now(UTC)

    for i in range(1, 76):
        receipt_id = uuid.uuid4()
        storage_path = f"receipts/phase0_rec_{i}.jpg"
        storage.files[f"receipts/{storage_path}"] = (
            b"fake_image_bytes",
            "image/jpeg",
        )

        if i <= 45:
            confidence = 0.96
            txn_date_str = "2026-08-10"
            items = [
                ExtractedLineItem(
                    description=f"Item A{i}",
                    qty=1.0,
                    unit_price=100000,
                    line_total=100000,
                    confidence=0.98,
                ),
                ExtractedLineItem(
                    description=f"Item B{i}",
                    qty=2.0,
                    unit_price=50000,
                    line_total=100000,
                    confidence=0.97,
                ),
            ]
            subtotal = 200000
            vat = 24000
            total = 224000
            merchant = "National Book Store"
        elif i <= 55:
            confidence = 0.85
            txn_date_str = "2026-08-15"
            items = [
                ExtractedLineItem(
                    description=f"Lunch Meal {i}",
                    qty=10.0,
                    unit_price=15000,
                    line_total=150000,
                    confidence=0.86,
                )
            ]
            subtotal = 150000
            vat = 18000
            total = 168000
            merchant = "Jollibee Food Corp"
        elif i <= 65:
            confidence = 0.94
            txn_date_str = "2026-08-20"
            items = [
                ExtractedLineItem(
                    description=f"Supplies {i}",
                    qty=1.0,
                    unit_price=100000,
                    line_total=100000,
                    confidence=0.95,
                )
            ]
            subtotal = 150000
            vat = 18000
            total = 168000
            merchant = "Silicon Valley Supplies"
        elif i <= 70:
            confidence = 0.95
            txn_date_str = "2026-07-15"
            items = [
                ExtractedLineItem(
                    description=f"Pre-event Cargo {i}",
                    qty=1.0,
                    unit_price=300000,
                    line_total=300000,
                    confidence=0.96,
                )
            ]
            subtotal = 300000
            vat = 36000
            total = 336000
            merchant = "Lalamove Logistics"
        else:
            confidence = 0.58
            txn_date_str = "2026-08-25"
            items = [
                ExtractedLineItem(
                    description=f"Unknown {i}",
                    qty=1.0,
                    unit_price=50000,
                    line_total=50000,
                    confidence=0.55,
                )
            ]
            subtotal = 50000
            vat = 6000
            total = 56000
            merchant = "Corner Convenience"

        extraction = ReceiptExtraction(
            merchant_name=merchant,
            merchant_tin="123-456-789-000",
            merchant_address="Metro Manila",
            or_number=f"OR-PHASE0-{i:03d}",
            txn_date=txn_date_str,
            line_items=items,
            subtotal=subtotal,
            vat_amount=vat,
            total_amount=total,
            confidence=confidence,
        )

        # 3. VERIFY
        v_report = verify_receipt(extraction=extraction, context=context)

        # 4. CLASSIFY
        class_res = await classify_merchant(
            merchant_name=merchant,
            allowed_categories=[bl["category"] for bl in budget_lines],
            rules=merchant_rules,
        )

        status_str = "verified"
        if v_report.routing.value == "auto_approve":
            counts["auto_approved"] += 1
        elif v_report.routing.value == "soft_flag":
            counts["soft_flagged"] += 1
        else:
            counts["exceptions"] += 1
            status_str = "exception"

        # Insert receipt record
        rec_obj = ReceiptRecord(
            id=receipt_id,
            workspace_id=workspace_id,
            activity_id=activity_id,
            uploaded_by=treasurer_id,
            storage_path=storage_path,
            sha256=f"sha256_{i}_{receipt_id}",
            perceptual_hash="1100110011001100",
            status=status_str,
            created_at=now,
            updated_at=now,
        )
        # Store metadata on object for ledger and reports
        rec_obj.merchant_name = merchant
        rec_obj.txn_date = date.fromisoformat(txn_date_str)
        rec_obj.or_number = f"OR-PHASE0-{i:03d}"
        rec_obj.total_amount = total
        rec_obj.subtotal = subtotal
        rec_obj.vat_amount = vat
        rec_obj.category = class_res.category
        rec_obj.confidence = confidence

        repo.receipts.append(rec_obj)

        # Record exceptions
        for exc in v_report.exceptions:
            exc_record = ExceptionRecord(
                id=uuid.uuid4(),
                receipt_id=receipt_id,
                activity_id=activity_id,
                kind=str(exc.kind),
                severity=str(exc.severity),
                question_text=exc.question_text,
                suggested_values=exc.suggested_values,
                status="open",
                created_at=now,
                updated_at=now,
            )

            repo.exceptions.append(exc_record)

        # For exceptions, resolve so pipeline reaches 100% liquidation seal
        if v_report.exceptions:
            for exc in repo.exceptions:
                if exc.receipt_id == receipt_id and exc.status == "open":
                    exc.status = "resolved"
                    exc.resolved_by = treasurer_id
                    exc.resolution_note = "Resolved during automated Phase 0 review."
                    counts["resolved_exceptions"] += 1
            rec_obj.status = "verified"

        # 5. APPROVE TO LEDGER
        app_res = client.post(
            f"/receipts/{receipt_id}/approve",
            headers=headers,
        )
        assert app_res.status_code == 200
        counts["approved_to_ledger"] += 1
        approved_receipt_ids.append(receipt_id)

    # 6. EXPORT EVIDENCE PACKET & SEAL
    packet_result = await build_evidence_packet(
        activity_id=activity_id,
        generated_by=treasurer_id,
        db=repo,
        receipt_image_loader=lambda p: storage.files.get(
            f"receipts/{p}", (b"fake_image_bytes", "image/jpeg")
        )[0],
    )

    # 7. Verification Assertions on recorded Phase 0 counts
    assert counts["total"] == 75
    assert counts["auto_approved"] == 45
    assert counts["soft_flagged"] == 10
    assert counts["exceptions"] == 20
    assert counts["approved_to_ledger"] == 75
    assert (
        packet_result.total_files == 75 + 3 + 1
    )  # 75 receipts + 3 PDFs + manifest.json
    assert len(packet_result.content_sha256) == 64
    assert len(packet_result.zip_bytes) > 1000
    assert len(packet_result.manifest.files) == 78  # 75 receipts + 3 PDFs
