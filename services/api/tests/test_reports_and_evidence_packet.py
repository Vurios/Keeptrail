"""Acceptance tests for Prompt 10: Reports and Evidence Packet ZIP."""

import hashlib
import io
import json
import uuid
import zipfile

import pytest

from katibay_api.db import InMemoryRepository, ReceiptRecord, set_db_repository
from katibay_api.reconciliation.engine import compute_reconciliation
from katibay_api.reconciliation.models import BudgetLineItem, ExpenseRecord
from katibay_api.reports.models import ReportSignatures
from katibay_api.reports.packet import build_evidence_packet
from katibay_api.reports.renderer import (
    build_report_context,
    render_html_to_pdf,
    render_report_html,
)
from katibay_api.verification.translations import format_centavos_peso


@pytest.fixture
def activity_data():
    """Sets up an activity with budget lines and approved receipts."""
    mock_db = InMemoryRepository()
    set_db_repository(mock_db)

    workspace_id = uuid.uuid4()
    activity_id = uuid.uuid4()
    user_id = uuid.uuid4()
    treasurer_id = uuid.uuid4()

    cash_advance = 3000000  # ₱30,000.00

    activity = {
        "id": activity_id,
        "workspace_id": workspace_id,
        "title": "Leadership Summit 2026",
        "start_date": "2026-08-10",
        "end_date": "2026-08-12",
        "cash_advance_amount": cash_advance,
        "status": "collecting",
    }
    mock_db.activities.append(activity)

    # Budget lines
    bl1_id = uuid.uuid4()
    bl2_id = uuid.uuid4()
    bl3_id = uuid.uuid4()
    budget_lines = [
        {
            "id": bl1_id,
            "activity_id": activity_id,
            "category": "Food & Catering",
            "approved_amount": 1500000,
        },
        {
            "id": bl2_id,
            "activity_id": activity_id,
            "category": "Transportation",
            "approved_amount": 800000,
        },
        {
            "id": bl3_id,
            "activity_id": activity_id,
            "category": "Materials",
            "approved_amount": 700000,
        },
    ]
    mock_db.budget_lines.extend(budget_lines)

    # Approved Receipts & Ledger entries
    # 1. Jollibee
    r1_id = uuid.uuid4()
    r1 = ReceiptRecord(
        id=r1_id,
        workspace_id=workspace_id,
        activity_id=activity_id,
        uploaded_by=user_id,
        storage_path=f"receipts/{r1_id}.jpg",
        sha256="1" * 64,
        perceptual_hash="0" * 16,
        status="approved",
        created_at=None,
        updated_at=None,
    )
    r1.merchant_name = "Jollibee Summit Branch"
    r1.merchant_tin = "000-111-222-000"
    r1.txn_date = "2026-08-10"
    r1.or_number = "OR-1001"
    r1.total_amount = 1250000  # ₱12,500.00
    r1.category = "Food & Catering"
    r1.confidence = 0.98
    mock_db.receipts.append(r1)

    mock_db.ledger_entries.append(
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "receipt_id": r1_id,
            "budget_line_id": bl1_id,
            "amount": 1250000,
            "category": "Food & Catering",
            "approved_by": treasurer_id,
            "approved_at": "2026-08-15T10:00:00Z",
            "created_at": "2026-08-15T10:00:00Z",
        }
    )

    # 2. Shell Gas
    r2_id = uuid.uuid4()
    r2 = ReceiptRecord(
        id=r2_id,
        workspace_id=workspace_id,
        activity_id=activity_id,
        uploaded_by=user_id,
        storage_path=f"receipts/{r2_id}.jpg",
        sha256="2" * 64,
        perceptual_hash="0" * 16,
        status="approved",
        created_at=None,
        updated_at=None,
    )
    r2.merchant_name = "Shell Station"
    r2.merchant_tin = "333-444-555-000"
    r2.txn_date = "2026-08-11"
    r2.or_number = "SI-8899"
    r2.total_amount = 600000  # ₱6,000.00
    r2.category = "Transportation"
    r2.confidence = 0.96
    mock_db.receipts.append(r2)

    mock_db.ledger_entries.append(
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "receipt_id": r2_id,
            "budget_line_id": bl2_id,
            "amount": 600000,
            "category": "Transportation",
            "approved_by": treasurer_id,
            "approved_at": "2026-08-15T10:30:00Z",
            "created_at": "2026-08-15T10:30:00Z",
        }
    )

    # 3. National Book Store
    r3_id = uuid.uuid4()
    r3 = ReceiptRecord(
        id=r3_id,
        workspace_id=workspace_id,
        activity_id=activity_id,
        uploaded_by=user_id,
        storage_path=f"receipts/{r3_id}.jpg",
        sha256="3" * 64,
        perceptual_hash="0" * 16,
        status="approved",
        created_at=None,
        updated_at=None,
    )
    r3.merchant_name = "National Book Store"
    r3.merchant_tin = "666-777-888-000"
    r3.txn_date = "2026-08-12"
    r3.or_number = "OR-5544"
    r3.total_amount = 650000  # ₱6,500.00
    r3.category = "Materials"
    r3.confidence = 0.99
    mock_db.receipts.append(r3)

    mock_db.ledger_entries.append(
        {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "receipt_id": r3_id,
            "budget_line_id": bl3_id,
            "amount": 650000,
            "category": "Materials",
            "approved_by": treasurer_id,
            "approved_at": "2026-08-15T11:00:00Z",
            "created_at": "2026-08-15T11:00:00Z",
        }
    )

    return {
        "db": mock_db,
        "workspace_id": workspace_id,
        "activity_id": activity_id,
        "activity": activity,
        "treasurer_id": treasurer_id,
        "budget_lines": budget_lines,
        "cash_advance": cash_advance,
    }


# ===========================================================================
# 1. HTML Rendering & Reconciliation Snapshot Equality Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_rendered_html_totals_equal_reconciliation_output(activity_data):
    """Acceptance: Rendered HTML totals match Reconciliation Engine output."""
    db = activity_data["db"]
    activity_id = activity_data["activity_id"]
    activity = activity_data["activity"]

    # 1. Run Reconciliation calculation
    bl_models = [
        BudgetLineItem(
            id=b["id"],
            category=b["category"],
            approved_amount=b["approved_amount"],
        )
        for b in activity_data["budget_lines"]
    ]
    raw_ledger = await db.get_activity_ledger_entries(activity_id)
    exp_models = [
        ExpenseRecord(category=e["category"], amount=e["amount"]) for e in raw_ledger
    ]

    reconciliation = compute_reconciliation(
        activity_id=activity_id,
        title=activity["title"],
        cash_advance_amount=activity["cash_advance_amount"],
        budget_lines=bl_models,
        expenses=exp_models,
    )

    # 2. Render HTML templates
    signatures = ReportSignatures(
        treasurer_name="Maria Santos",
        president_name="Juan Dela Cruz",
        adviser_name="Prof. Jose Rizal",
    )
    context = build_report_context(
        activity=activity,
        budget_lines=activity_data["budget_lines"],
        ledger_entries_raw=raw_ledger,
        signatures=signatures,
        org_name="UP Computer Science Guild",
    )

    liquidation_html = render_report_html("liquidation_report.html", context)
    expense_html = render_report_html("expense_summary.html", context)
    variance_html = render_report_html("variance_report.html", context)

    # Assert rendered strings contain exact formatted totals
    expected_ca_str = format_centavos_peso(reconciliation.cash_advance_amount)
    expected_spend_str = format_centavos_peso(reconciliation.total_actual_spend)
    expected_net_str = format_centavos_peso(reconciliation.net_balance)
    expected_approved_str = format_centavos_peso(reconciliation.total_approved)

    assert f"₱{expected_ca_str}" in liquidation_html
    assert f"₱{expected_spend_str}" in liquidation_html
    assert f"₱{expected_net_str}" in liquidation_html
    assert f"₱{expected_approved_str}" in liquidation_html

    assert f"₱{expected_spend_str}" in expense_html
    assert "Maria Santos" in expense_html
    assert "Juan Dela Cruz" in expense_html

    assert f"₱{expected_approved_str}" in variance_html
    assert f"₱{expected_spend_str}" in variance_html
    assert "Leadership Summit 2026" in variance_html


# ===========================================================================
# 2. WeasyPrint PDF Generation & Grayscale Print Formatting Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_weasyprint_pdf_rendering(activity_data):
    """Acceptance: Renders all three reports to valid A4 PDF bytes."""
    db = activity_data["db"]
    activity_id = activity_data["activity_id"]
    activity = activity_data["activity"]
    raw_ledger = await db.get_activity_ledger_entries(activity_id)

    context = build_report_context(
        activity=activity,
        budget_lines=activity_data["budget_lines"],
        ledger_entries_raw=raw_ledger,
    )

    templates = [
        "liquidation_report.html",
        "expense_summary.html",
        "variance_report.html",
    ]
    for template_name in templates:
        html = render_report_html(template_name, context)
        pdf_bytes = render_html_to_pdf(html)

        # Valid PDF signature '%PDF-'
        assert pdf_bytes.startswith(b"%PDF-")
        assert len(pdf_bytes) >= 500


# ===========================================================================
# 3. Evidence Packet ZIP & Cryptographic Manifest Verification Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_build_evidence_packet_manifest_hash_verification(activity_data):
    """Acceptance: Every file inside the ZIP matches the SHA-256 in manifest."""
    db = activity_data["db"]
    activity_id = activity_data["activity_id"]
    treasurer_id = activity_data["treasurer_id"]

    mock_image_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"

    packet_result = await build_evidence_packet(
        activity_id=activity_id,
        generated_by=treasurer_id,
        signatures=ReportSignatures(treasurer_name="Maria Santos"),
        db=db,
        receipt_image_loader=lambda path: mock_image_bytes,
    )

    # 1. Verify ZIP SHA-256 matches output
    computed_zip_sha = hashlib.sha256(packet_result.zip_bytes).hexdigest()
    assert packet_result.content_sha256 == computed_zip_sha

    # 2. Open ZIP and verify all files against manifest.json
    zip_buffer = io.BytesIO(packet_result.zip_bytes)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist
        assert "reports/liquidation_report.pdf" in namelist
        assert "reports/expense_summary.pdf" in namelist
        assert "reports/variance_report.pdf" in namelist

        manifest_raw = zf.read("manifest.json")
        manifest_data = json.loads(manifest_raw.decode("utf-8"))

        manifest_files = {item["path"]: item for item in manifest_data["files"]}

        # Check every file recorded in manifest matches its actual zip SHA-256
        for file_path, item in manifest_files.items():
            actual_bytes = zf.read(file_path)
            actual_sha256 = hashlib.sha256(actual_bytes).hexdigest()
            assert item["sha256"] == actual_sha256, f"Hash mismatch for {file_path}"
            assert item["size_bytes"] == len(actual_bytes)

    # 3. Verify Database export record and audit event
    exports = await db.get_exports(activity_id)
    assert len(exports) == 1
    exp = exports[0]
    assert exp["kind"] == "evidence_zip"
    assert exp["content_sha256"] == computed_zip_sha

    audit_events = [a for a in db.audit_events if a.entity_type == "exports"]
    assert len(audit_events) == 1
    assert audit_events[0].action == "evidence_packet_generated"
    assert audit_events[0].after["content_sha256"] == computed_zip_sha
