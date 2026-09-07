"""Pydantic schemas for receipt upload endpoints."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class UploadReceiptItemResult(BaseModel):
    """Result for a single uploaded receipt file."""

    receipt_id: uuid.UUID
    workspace_id: uuid.UUID
    activity_id: uuid.UUID | None = None
    filename: str
    file_size_bytes: int
    mime_type: str
    sha256: str
    perceptual_hash: str
    status: str
    is_duplicate: bool
    exception_id: uuid.UUID | None = None
    matched_receipt_id: uuid.UUID | None = None
    match_type: Literal["sha256", "phash"] | None = None
    hamming_distance: int | None = None
    job_enqueued: bool
    created_at: datetime


class BatchReceiptUploadResponse(BaseModel):
    """Response returned by POST /workspaces/{id}/receipts."""

    workspace_id: uuid.UUID
    processed_count: int
    items: list[UploadReceiptItemResult]
