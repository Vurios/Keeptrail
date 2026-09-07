"""Classification domain models."""

import uuid
from dataclasses import dataclass
from enum import StrEnum

from katibay_api.verification.models import VerificationException


class ClassificationSource(StrEnum):
    """Source of the category assignment."""

    RULE = "rule"
    GEMINI = "gemini"
    FALLBACK = "fallback"


@dataclass(frozen=True)
class MerchantRule:
    """Deterministic pattern mapping for merchant names."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    pattern: str  # Regex or substring pattern
    category: str


@dataclass(frozen=True)
class CategoryClassificationResult:
    """Outcome of category classification."""

    category: str | None
    confidence: float
    source: ClassificationSource
    rule_matched: str | None = None
    rationale: str | None = None
    exception: VerificationException | None = None
