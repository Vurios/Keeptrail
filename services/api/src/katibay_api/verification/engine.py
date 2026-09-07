"""Deterministic verification engine and confidence routing."""

from katibay_api.extraction.schemas import ReceiptExtraction
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


def verify_receipt(
    extraction: ReceiptExtraction,
    context: ActivityContext | None = None,
    min_auto_approve_confidence: float = 0.92,
    min_soft_flag_confidence: float = 0.70,
    arithmetic_tolerance_centavos: int = 2,
) -> VerificationReport:
    """Pure verification executing deterministic rules without mutating data."""
    ctx = context or ActivityContext()

    checks: list[CheckResult] = [
        check_arithmetic(extraction, tolerance_centavos=arithmetic_tolerance_centavos),
        check_date_window(extraction, ctx),
        check_future_date(extraction, ctx),
        check_or_number_format(extraction),
        check_confidence(extraction, min_soft_flag=min_soft_flag_confidence),
    ]

    exceptions: list[VerificationException] = []
    has_blocking_exception = False
    has_warning_exception = False

    for c in checks:
        if not c.passed and c.exception:
            exceptions.append(c.exception)
            if c.exception.severity == "blocking":
                has_blocking_exception = True
            elif c.exception.severity == "warning":
                has_warning_exception = True

    confidence = extraction.confidence

    # Compute Routing:
    # 1. Exception: Any blocking check failure OR overall confidence < 0.70
    if has_blocking_exception or confidence < min_soft_flag_confidence:
        routing = VerificationRouting.EXCEPTION
    # 2. Soft Flag: Non-blocking warnings OR confidence in [0.70, 0.92)
    elif has_warning_exception or confidence < min_auto_approve_confidence:
        routing = VerificationRouting.SOFT_FLAG
    # 3. Auto Approve: Confidence >= 0.92 AND all checks passed cleanly
    else:
        routing = VerificationRouting.AUTO_APPROVE

    is_all_passed = len(exceptions) == 0

    return VerificationReport(
        routing=routing,
        passed=is_all_passed,
        checks=tuple(checks),
        exceptions=tuple(exceptions),
        confidence=confidence,
    )
