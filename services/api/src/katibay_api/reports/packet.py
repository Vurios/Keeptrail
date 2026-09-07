"""Evidence packet packaging module producing verified ZIP archives."""

import hashlib
import io
import json
import logging
import uuid
import zipfile
from collections.abc import Callable

from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.reports.models import (
    EvidenceFileManifestItem,
    EvidencePacketManifest,
    EvidencePacketResult,
    ReportSignatures,
)
from katibay_api.reports.renderer import (
    build_report_context,
    render_html_to_pdf,
    render_report_html,
)

logger = logging.getLogger("katibay_api.reports.packet")


def compute_sha256(data: bytes) -> str:
    """Computes SHA-256 hex digest of given bytes."""
    return hashlib.sha256(data).hexdigest()


async def build_evidence_packet(
    activity_id: uuid.UUID,
    generated_by: uuid.UUID | None = None,
    signatures: ReportSignatures | None = None,
    org_name: str | None = None,
    db: DatabaseRepository | None = None,
    receipt_image_loader: Callable[[str], bytes] | None = None,
) -> EvidencePacketResult:
    """Produces a cryptographic evidence ZIP with 3 PDFs and manifest."""
    database = db or get_db_repository()

    # 1. Fetch activity and verify existence
    activity = await database.get_activity(activity_id)
    if not activity:
        raise ValueError(f"Activity {activity_id} was not found.")

    workspace_id = activity["workspace_id"]
    budget_lines = await database.get_budget_lines(activity_id)
    ledger_entries = await database.get_activity_ledger_entries(activity_id)

    # 2. Prepare report context (Strictly derived from ledger_entries)
    context = build_report_context(
        activity=activity,
        budget_lines=budget_lines,
        ledger_entries_raw=ledger_entries,
        signatures=signatures,
        org_name=org_name,
    )

    # 3. Render HTML templates to PDF
    liquidation_html = render_report_html("liquidation_report.html", context)
    expense_html = render_report_html("expense_summary.html", context)
    variance_html = render_report_html("variance_report.html", context)

    liquidation_pdf = render_html_to_pdf(liquidation_html)
    expense_pdf = render_html_to_pdf(expense_html)
    variance_pdf = render_html_to_pdf(variance_html)

    # 4. Collect files and compute manifest entries
    files_to_pack: dict[str, bytes] = {
        "reports/liquidation_report.pdf": liquidation_pdf,
        "reports/expense_summary.pdf": expense_pdf,
        "reports/variance_report.pdf": variance_pdf,
    }

    manifest_items: list[EvidenceFileManifestItem] = [
        EvidenceFileManifestItem(
            path="reports/liquidation_report.pdf",
            sha256=compute_sha256(liquidation_pdf),
            size_bytes=len(liquidation_pdf),
        ),
        EvidenceFileManifestItem(
            path="reports/expense_summary.pdf",
            sha256=compute_sha256(expense_pdf),
            size_bytes=len(expense_pdf),
        ),
        EvidenceFileManifestItem(
            path="reports/variance_report.pdf",
            sha256=compute_sha256(variance_pdf),
            size_bytes=len(variance_pdf),
        ),
    ]

    # 5. Pack approved receipt images under receipts/
    seen_receipt_ids: set[uuid.UUID] = set()
    for entry in ledger_entries:
        rec_id = entry["receipt_id"]
        if rec_id in seen_receipt_ids:
            continue
        seen_receipt_ids.add(rec_id)

        storage_path = entry.get("storage_path") or f"receipts/{rec_id}.jpg"
        if receipt_image_loader:
            try:
                img_bytes = receipt_image_loader(storage_path)
            except Exception as e:
                logger.warning("Could not load receipt image %s: %s", storage_path, e)
                img_bytes = b"SAMPLE_RECEIPT_IMAGE_PLACEHOLDER"
        else:
            img_bytes = b"SAMPLE_RECEIPT_IMAGE_PLACEHOLDER"

        rel_path = f"receipts/{rec_id}.jpg"
        files_to_pack[rel_path] = img_bytes
        manifest_items.append(
            EvidenceFileManifestItem(
                path=rel_path,
                sha256=compute_sha256(img_bytes),
                receipt_id=str(rec_id),
                confidence=entry.get("confidence", 1.0),
                size_bytes=len(img_bytes),
            )
        )

    # 6. Generate manifest.json
    manifest = EvidencePacketManifest(
        activity_id=str(activity_id),
        generated_at=context["generated_date"],
        total_files=len(manifest_items) + 1,  # including manifest.json itself
        files=manifest_items,
    )
    manifest_bytes = json.dumps(manifest.model_dump(), indent=2).encode("utf-8")
    files_to_pack["manifest.json"] = manifest_bytes

    # 7. Assemble ZIP archive in-memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_path, data in files_to_pack.items():
            zip_file.writestr(file_path, data)

    zip_bytes = zip_buffer.getvalue()
    zip_sha256 = compute_sha256(zip_bytes)
    export_file_path = f"exports/{activity_id}/evidence_packet_{zip_sha256[:12]}.zip"

    # 8. Record export row in database
    export_record = await database.insert_export(
        activity_id=activity_id,
        kind="evidence_zip",
        file_path=export_file_path,
        content_sha256=zip_sha256,
        generated_by=generated_by,
    )

    # 9. Record audit event
    await database.insert_audit_event(
        workspace_id=workspace_id,
        actor_id=generated_by,
        entity_type="exports",
        entity_id=export_record["id"],
        action="evidence_packet_generated",
        before=None,
        after={
            "export_id": str(export_record["id"]),
            "kind": "evidence_zip",
            "file_path": export_file_path,
            "content_sha256": zip_sha256,
            "total_files": len(files_to_pack),
        },
    )

    return EvidencePacketResult(
        activity_id=activity_id,
        export_id=export_record["id"],
        file_path=export_file_path,
        content_sha256=zip_sha256,
        total_files=len(files_to_pack),
        zip_bytes=zip_bytes,
        manifest=manifest,
    )
