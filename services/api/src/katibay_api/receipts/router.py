"""FastAPI router for receipt upload, signed URLs, and approval endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    UploadFile,
    status,
)

from katibay_api.auth import (
    AuthenticatedUser,
    assert_workspace_access,
    get_current_user,
    require_workspace_member,
)
from katibay_api.config import settings
from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.errors import UNPROCESSABLE_STATUS
from katibay_api.ratelimit import RateLimitDependency
from katibay_api.receipts.schemas import (
    BatchReceiptUploadResponse,
    UploadReceiptItemResult,
)
from katibay_api.receipts.service import process_receipt_upload
from katibay_api.storage import get_storage_client

router = APIRouter(tags=["Receipts"])


@router.post(
    "/workspaces/{id}/receipts",
    response_model=BatchReceiptUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload one or more receipt images or PDFs to a workspace",
)
async def upload_workspace_receipts(
    id: Annotated[uuid.UUID, Path(description="Workspace ID")],
    user: Annotated[AuthenticatedUser, Depends(require_workspace_member)],
    files: Annotated[
        list[UploadFile],
        File(description="One or more receipt image/PDF files"),
    ],
    activity_id: Annotated[
        uuid.UUID | None,
        Form(description="Optional activity ID to associate"),
    ] = None,
    _rate_limit: RateLimitDependency = None,
) -> BatchReceiptUploadResponse:
    """Accepts one or more receipt files (JPEG/PNG/HEIC/PDF, max 10 MB each).

    Requires membership of the target workspace. Uploads are attributed to the
    authenticated user; attribution is never taken from the request body.
    Protected by sliding-window rate limiting.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file must be provided in the 'files' field.",
        )

    if len(files) > settings.max_files_per_upload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A single request may carry at most "
                f"{settings.max_files_per_upload} files; received {len(files)}."
            ),
        )

    results: list[UploadReceiptItemResult] = []

    for file in files:
        file_bytes = await file.read()
        filename = file.filename or "receipt.jpg"
        declared_mime = file.content_type

        result = await process_receipt_upload(
            workspace_id=id,
            filename=filename,
            raw_bytes=file_bytes,
            declared_mime=declared_mime,
            uploaded_by=user.id,
            activity_id=activity_id,
        )
        results.append(result)

    return BatchReceiptUploadResponse(
        workspace_id=id,
        processed_count=len(results),
        items=results,
    )


@router.get(
    "/receipts/{id}/signed-url",
    summary="Generates a temporary signed URL with strict 60-second expiration",
)
async def get_receipt_signed_url(
    id: Annotated[uuid.UUID, Path(description="Receipt UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> dict[str, Any]:
    """Generates a secure temporary signed URL for a receipt image (60s)."""

    receipt = await db.get_receipt(id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt {id} was not found.",
        )

    # Authentication alone is not authorization: a signed URL hands out the
    # original document, so membership of the owning workspace is required.
    assert_workspace_access(user, receipt["workspace_id"])

    storage_path = receipt.get("storage_path")
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt {id} does not have an associated storage path.",
        )

    storage = get_storage_client()
    signed_url = await storage.create_signed_url(
        bucket=settings.supabase_storage_bucket_receipts,
        path=storage_path,
        expires_in=60,
    )

    return {
        "receipt_id": id,
        "storage_path": storage_path,
        "signed_url": signed_url,
        "expires_in_seconds": 60,
    }


@router.post("/receipts/{id}/approve")
async def approve_receipt_endpoint(
    id: Annotated[uuid.UUID, Path(description="Receipt UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> dict[str, Any]:
    """Approves a verified receipt and moves it into ledger_entries.

    Requires 'owner' or 'treasurer' role.
    """
    receipt = await db.get_receipt(id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt {id} was not found.",
        )

    workspace_id = receipt["workspace_id"]
    assert_workspace_access(user, workspace_id, allowed_roles=("owner", "treasurer"))

    activity_id = receipt.get("activity_id")
    if not activity_id:
        raise HTTPException(
            status_code=UNPROCESSABLE_STATUS,
            detail="Cannot approve a receipt that is not bound to an activity.",
        )

    # Check for blocking exceptions on this receipt
    blocking_exceptions = await db.get_activity_exceptions(
        activity_id=activity_id,
        severity="blocking",
        status="open",
    )
    receipt_blocking = [e for e in blocking_exceptions if e.get("receipt_id") == id]
    if receipt_blocking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot approve receipt with {len(receipt_blocking)} open "
                f"blocking exceptions."
            ),
        )

    # Resolve budget line if matched by category
    category = receipt.get("category") or "General"
    budget_lines = await db.get_budget_lines(activity_id)
    matched_budget_line_id = None
    for bl in budget_lines:
        if bl["category"].lower() == category.lower():
            matched_budget_line_id = bl["id"]
            break

    # Rule 1: no LLM output becomes a financial total, and an unknown total is
    # not zero. Booking a null amount as 0 would silently understate the ledger.
    amount = receipt.get("total_amount")
    if amount is None:
        raise HTTPException(
            status_code=UNPROCESSABLE_STATUS,
            detail=(
                "Cannot approve a receipt with no confirmed total. Resolve the "
                "amount through review before approving it into the ledger."
            ),
        )

    # 1. Insert into ledger_entries
    ledger_entry = await db.insert_ledger_entry(
        activity_id=activity_id,
        receipt_id=id,
        budget_line_id=matched_budget_line_id,
        amount=amount,
        category=category,
        approved_by=user.id,
    )

    # 2. Update receipt status to 'approved'
    before_receipt = {"status": receipt["status"]}
    updated_receipt = await db.update_receipt(receipt_id=id, status="approved")
    after_receipt = {"status": "approved"}

    # 3. Write audit event
    await db.insert_audit_event(
        workspace_id=workspace_id,
        actor_id=user.id,
        entity_type="receipts",
        entity_id=id,
        action="receipt_approved",
        before=before_receipt,
        after=after_receipt,
    )

    return {
        "receipt": updated_receipt,
        "ledger_entry": ledger_entry,
    }
