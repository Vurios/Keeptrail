"""Report domain models, contexts, and evidence packet manifest schemas."""

import uuid
from dataclasses import dataclass

from pydantic import BaseModel, Field


@dataclass(frozen=True)
class ReportSignatures:
    """Signatory roles for official student organization reports."""

    treasurer_name: str | None = None
    president_name: str | None = None
    adviser_name: str | None = None


@dataclass(frozen=True)
class CategoryReportItem:
    """Aggregated budget and actual metrics for a single category."""

    category: str
    approved_amount: int  # in centavos
    actual_amount: int  # in centavos
    variance: int  # in centavos
    is_over_budget: bool
    utilization_pct: float
    progress_width: float
    approved_formatted: str
    actual_formatted: str
    variance_formatted: str


@dataclass(frozen=True)
class LedgerReportItem:
    """Approved disbursement item from public.ledger_entries."""

    id: uuid.UUID
    receipt_id: uuid.UUID
    txn_date: str | None
    or_number: str | None
    merchant_name: str | None
    merchant_tin: str | None
    category: str
    amount: int  # in centavos
    amount_formatted: str
    confidence: float
    storage_path: str
    sha256: str


class EvidenceFileManifestItem(BaseModel):
    """Manifest entry for a single file contained in the evidence ZIP."""

    path: str
    sha256: str
    receipt_id: str | None = None
    confidence: float | None = None
    size_bytes: int


class EvidencePacketManifest(BaseModel):
    """Full cryptographic manifest for the activity evidence packet."""

    activity_id: str
    generated_at: str
    total_files: int
    files: list[EvidenceFileManifestItem] = Field(default_factory=list)


@dataclass(frozen=True)
class EvidencePacketResult:
    """Outcome of building an activity evidence packet."""

    activity_id: uuid.UUID
    export_id: uuid.UUID
    file_path: str
    content_sha256: str
    total_files: int
    zip_bytes: bytes
    manifest: EvidencePacketManifest
