"""Receipt upload and duplicate-checking business logic."""

import hashlib
import mimetypes
import uuid

from fastapi import HTTPException

from katibay_api.config import settings
from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.duplicates import evaluate_duplicate
from katibay_api.errors import CONTENT_TOO_LARGE_STATUS, UNPROCESSABLE_STATUS
from katibay_api.preprocessing import preprocess_receipt_image
from katibay_api.receipts.schemas import UploadReceiptItemResult
from katibay_api.storage import StorageClientProtocol, get_storage_client

ALLOWED_MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
}


def normalize_mime_type(
    filename: str, declared_mime: str | None, file_bytes: bytes
) -> str:
    """Detects and validates normalized MIME type for the receipt file."""
    # Check PDF magic bytes
    if file_bytes[:4] == b"%PDF":
        return "application/pdf"

    # Check JPEG magic bytes
    if file_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"

    # Check PNG magic bytes
    if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"

    # Check HEIC magic bytes
    if len(file_bytes) > 12 and file_bytes[4:12] in (
        b"ftypheic",
        b"ftypheix",
        b"ftypmif1",
        b"ftypmsf1",
        b"ftyphevc",
    ):
        return "image/heic"

    if declared_mime and declared_mime.lower() in ALLOWED_MIME_EXTENSIONS:
        return declared_mime.lower()

    # Fallback to filename extension guessing
    guessed, _ = mimetypes.guess_type(filename)
    if guessed and guessed.lower() in ALLOWED_MIME_EXTENSIONS:
        return guessed.lower()

    # Direct extension check
    fn_lower = filename.lower()
    if fn_lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if fn_lower.endswith(".png"):
        return "image/png"
    if fn_lower.endswith((".heic", ".heif")):
        return "image/heic"
    if fn_lower.endswith(".pdf"):
        return "application/pdf"

    raise HTTPException(
        status_code=UNPROCESSABLE_STATUS,
        detail=(
            f"Unsupported file format for '{filename}'. "
            "Allowed formats: JPEG, PNG, HEIC, PDF."
        ),
    )


async def process_receipt_upload(
    workspace_id: uuid.UUID,
    filename: str,
    raw_bytes: bytes,
    uploaded_by: uuid.UUID,
    declared_mime: str | None = None,
    activity_id: uuid.UUID | None = None,
    db_repo: DatabaseRepository | None = None,
    storage_client: StorageClientProtocol | None = None,
) -> UploadReceiptItemResult:
    """Processes an uploaded receipt file through validation, storage,
    and deduplication.

    ``uploaded_by`` is required: every stored receipt and audit event must be
    attributable to a real actor, never to a placeholder identity.
    """

    db = db_repo or get_db_repository()
    storage = storage_client or get_storage_client()
    user_id = uploaded_by

    # 1. Size Validation (max 10 MB per file)
    file_size = len(raw_bytes)
    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=CONTENT_TOO_LARGE_STATUS,
            detail=(
                f"File '{filename}' ({file_size} bytes) exceeds the maximum allowed "
                f"size of {settings.max_upload_size_bytes} bytes (10 MB)."
            ),
        )

    # 2. MIME Type Validation
    mime_type = normalize_mime_type(filename, declared_mime, raw_bytes)
    ext = ALLOWED_MIME_EXTENSIONS[mime_type]

    # 3. Compute SHA-256 of raw uploaded bytes
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
    receipt_id = uuid.uuid4()
    storage_path = f"{workspace_id}/{receipt_id}{ext}"

    # 4. Upload raw file to private Supabase Storage bucket 'receipts'
    await storage.upload_file(
        bucket=settings.supabase_storage_bucket_receipts,
        path=storage_path,
        content=raw_bytes,
        content_type=mime_type,
    )

    # 5. Image Preprocessing (EXIF rotation, deskew, CLAHE, downscale, q85, pHash)
    try:
        preprocessed = preprocess_receipt_image(
            file_bytes=raw_bytes,
            mime_type=mime_type,
            max_long_edge=settings.preprocessor_long_edge_px,
            jpeg_quality=settings.preprocessor_jpeg_quality,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=UNPROCESSABLE_STATUS,
            detail=f"Failed to preprocess receipt image '{filename}': {str(exc)}",
        ) from exc

    phash_str = preprocessed.phash

    # 6. Check duplicates in the workspace
    existing_candidates = await db.get_workspace_receipt_candidates(workspace_id)
    match_result = evaluate_duplicate(
        target_sha256=sha256_hash,
        target_phash=phash_str,
        existing_candidates=existing_candidates,
        threshold=settings.phash_hamming_distance_threshold,
    )

    # 7. Insert receipts row with status 'queued'
    receipt_row = await db.insert_receipt(
        receipt_id=receipt_id,
        workspace_id=workspace_id,
        uploaded_by=user_id,
        storage_path=storage_path,
        sha256=sha256_hash,
        perceptual_hash=phash_str,
        status="queued",
        activity_id=activity_id,
    )

    exception_id: uuid.UUID | None = None
    job_enqueued = False

    if match_result.is_duplicate:
        # 8a. Duplicate branch: Create duplicate exception, skip extraction job
        question_text = (
            f"This receipt appears to be a duplicate of an existing receipt in this "
            f"workspace (matched ID: {match_result.matched_receipt_id}, "
            f"match: {match_result.match_type}, "
            f"Hamming distance: {match_result.hamming_distance}). "
            "Would you like to waive it or reject it?"
        )
        suggested_values = {
            "matched_receipt_id": str(match_result.matched_receipt_id),
            "match_type": match_result.match_type,
            "hamming_distance": match_result.hamming_distance,
        }
        exception_row = await db.insert_duplicate_exception(
            receipt_id=receipt_id,
            activity_id=activity_id,
            question_text=question_text,
            suggested_values=suggested_values,
            severity="blocking",
        )
        exception_id = exception_row.id

        await db.insert_audit_event(
            workspace_id=workspace_id,
            actor_id=user_id,
            entity_type="receipt",
            entity_id=receipt_id,
            action="duplicate_exception_created",
            after={
                "exception_id": str(exception_id),
                "matched_receipt_id": str(match_result.matched_receipt_id),
                "match_type": match_result.match_type,
                "hamming_distance": match_result.hamming_distance,
            },
        )
    else:
        # 8b. Non-duplicate branch: Enqueue extract_receipt job
        await db.enqueue_extract_receipt_job(
            receipt_id=receipt_id,
            workspace_id=workspace_id,
            storage_path=storage_path,
        )
        job_enqueued = True

        await db.insert_audit_event(
            workspace_id=workspace_id,
            actor_id=user_id,
            entity_type="receipt",
            entity_id=receipt_id,
            action="receipt_uploaded",
            after={
                "receipt_id": str(receipt_id),
                "status": "queued",
                "storage_path": storage_path,
                "sha256": sha256_hash,
                "phash": phash_str,
            },
        )

    matched_uuid = None
    if match_result.matched_receipt_id:
        matched_uuid = (
            match_result.matched_receipt_id
            if isinstance(match_result.matched_receipt_id, uuid.UUID)
            else uuid.UUID(str(match_result.matched_receipt_id))
        )

    return UploadReceiptItemResult(
        receipt_id=receipt_row.id,
        workspace_id=receipt_row.workspace_id,
        activity_id=receipt_row.activity_id,
        filename=filename,
        file_size_bytes=file_size,
        mime_type=mime_type,
        sha256=sha256_hash,
        perceptual_hash=phash_str,
        status=receipt_row.status,
        is_duplicate=match_result.is_duplicate,
        exception_id=exception_id,
        matched_receipt_id=matched_uuid,
        match_type=match_result.match_type,
        hamming_distance=match_result.hamming_distance,
        job_enqueued=job_enqueued,
        created_at=receipt_row.created_at,
    )
