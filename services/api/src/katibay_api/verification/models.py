"""Verification models, schemas, and structured result types."""

import uuid
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from typing import Any


class VerificationRouting(StrEnum):
    """Routing classification for verified receipts."""

    AUTO_APPROVE = "auto_approve"
    SOFT_FLAG = "soft_flag"
    EXCEPTION = "exception"


@dataclass(frozen=True)
class ActivityContext:
    """Context of the target activity for verification."""

    activity_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    today: date = field(default_factory=date.today)


@dataclass(frozen=True)
class VerificationException:
    """Represents a discrete rule violation requiring user clarification."""

    kind: str
    severity: str
    question_text: str  # Plain-language English question
    question_key: str  # Translation identifier
    question_translations: dict[str, str] = field(default_factory=dict)
    suggested_values: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CheckResult:
    """Outcome of a single verification rule check."""

    check_name: str
    passed: bool
    details: str | None = None
    exception: VerificationException | None = None


@dataclass(frozen=True)
class VerificationReport:
    """Comprehensive verification result over a ReceiptExtraction."""

    routing: VerificationRouting
    passed: bool
    checks: tuple[CheckResult, ...]
    exceptions: tuple[VerificationException, ...]
    confidence: float
