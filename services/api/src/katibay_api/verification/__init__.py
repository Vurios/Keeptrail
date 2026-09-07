"""Katibay receipt verification subsystem."""

from katibay_api.verification.engine import verify_receipt
from katibay_api.verification.models import (
    ActivityContext,
    CheckResult,
    VerificationException,
    VerificationReport,
    VerificationRouting,
)
from katibay_api.verification.rules import (
    check_arithmetic,
    check_confidence,
    check_date_window,
    check_future_date,
    check_or_number_format,
)

__all__ = [
    "ActivityContext",
    "CheckResult",
    "VerificationException",
    "VerificationReport",
    "VerificationRouting",
    "verify_receipt",
    "check_arithmetic",
    "check_confidence",
    "check_date_window",
    "check_future_date",
    "check_or_number_format",
]
