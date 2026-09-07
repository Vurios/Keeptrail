"""Pure verification rules and check functions over ReceiptExtraction."""

from datetime import date, datetime

from katibay_api.extraction.schemas import ReceiptExtraction
from katibay_api.verification.models import (
    ActivityContext,
    CheckResult,
    VerificationException,
)
from katibay_api.verification.translations import (
    format_centavos_peso,
    get_question,
)


def parse_date(date_str: str | None) -> date | None:
    """Safely parses an ISO or standard date string."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def check_arithmetic(
    extraction: ReceiptExtraction,
    tolerance_centavos: int = 2,
) -> CheckResult:
    """Validates line item sum, subtotal + VAT = total, and 12% standard VAT."""
    # 1. Check Line Items Sum vs Subtotal
    if extraction.line_items and extraction.subtotal is not None:
        computed_line_sum = sum(item.line_total for item in extraction.line_items)
        diff = abs(computed_line_sum - extraction.subtotal)
        if diff > tolerance_centavos:
            params = {
                "line_sum": format_centavos_peso(computed_line_sum),
                "subtotal": format_centavos_peso(extraction.subtotal),
            }
            q_en, q_trans = get_question("arith_mismatch_line_items", params)
            return CheckResult(
                check_name="arithmetic",
                passed=False,
                details=(
                    f"Line items sum (₱{params['line_sum']}) differs from "
                    f"subtotal (₱{params['subtotal']}) by {diff} centavos."
                ),
                exception=VerificationException(
                    kind="arith_mismatch",
                    severity="blocking",
                    question_text=q_en,
                    question_key="arith_mismatch_line_items",
                    question_translations=q_trans,
                    suggested_values={
                        "computed_line_sum": computed_line_sum,
                        "extracted_subtotal": extraction.subtotal,
                        "difference": diff,
                    },
                ),
            )

    # 2. Check Subtotal + VAT vs Total
    if extraction.subtotal is not None and extraction.total_amount is not None:
        vat = extraction.vat_amount or 0
        computed_total = extraction.subtotal + vat
        diff = abs(computed_total - extraction.total_amount)
        if diff > tolerance_centavos:
            params = {
                "subtotal": format_centavos_peso(extraction.subtotal),
                "vat": format_centavos_peso(vat),
                "computed_total": format_centavos_peso(computed_total),
                "total": format_centavos_peso(extraction.total_amount),
            }
            q_en, q_trans = get_question("arith_mismatch_total", params)
            return CheckResult(
                check_name="arithmetic",
                passed=False,
                details=(
                    f"Subtotal + VAT (₱{params['computed_total']}) differs "
                    f"from total (₱{params['total']}) by {diff} centavos."
                ),
                exception=VerificationException(
                    kind="arith_mismatch",
                    severity="blocking",
                    question_text=q_en,
                    question_key="arith_mismatch_total",
                    question_translations=q_trans,
                    suggested_values={
                        "computed_total": computed_total,
                        "extracted_total": extraction.total_amount,
                        "difference": diff,
                    },
                ),
            )

    # 3. Check 12% Philippine VAT Rate (if VAT is stated)
    if (
        extraction.vat_amount is not None
        and extraction.vat_amount > 0
        and extraction.subtotal is not None
        and extraction.subtotal > 0
    ):
        expected_vat_exclusive = round(extraction.subtotal * 0.12)
        expected_vat_inclusive = (
            round((extraction.total_amount / 1.12) * 0.12)
            if extraction.total_amount
            else expected_vat_exclusive
        )

        diff_exclusive = abs(extraction.vat_amount - expected_vat_exclusive)
        diff_inclusive = abs(extraction.vat_amount - expected_vat_inclusive)

        if min(diff_exclusive, diff_inclusive) > tolerance_centavos:
            params = {
                "vat": format_centavos_peso(extraction.vat_amount),
                "expected_vat": format_centavos_peso(expected_vat_exclusive),
            }
            q_en, q_trans = get_question("arith_mismatch_vat", params)
            return CheckResult(
                check_name="arithmetic",
                passed=False,
                details=(f"VAT (₱{params['vat']}) deviates from 12% standard rate."),
                exception=VerificationException(
                    kind="arith_mismatch",
                    severity="warning",
                    question_text=q_en,
                    question_key="arith_mismatch_vat",
                    question_translations=q_trans,
                    suggested_values={
                        "extracted_vat": extraction.vat_amount,
                        "expected_vat_exclusive": expected_vat_exclusive,
                        "expected_vat_inclusive": expected_vat_inclusive,
                    },
                ),
            )

    return CheckResult(check_name="arithmetic", passed=True)


def check_date_window(
    extraction: ReceiptExtraction,
    context: ActivityContext,
) -> CheckResult:
    """Verifies that the transaction date falls within activity start/end."""
    if not extraction.txn_date:
        return CheckResult(
            check_name="date_window",
            passed=False,
            details="Transaction date is missing from extraction.",
            exception=VerificationException(
                kind="out_of_period",
                severity="warning",
                question_text=(
                    "The transaction date is missing. When was this purchase " "made?"
                ),
                question_key="out_of_period_window",
                question_translations={
                    "en": (
                        "The transaction date is missing. When was this "
                        "purchase made?"
                    ),
                    "fil": (
                        "Nawawala ang petsa ng transaksyon. Kailan ginawa ang "
                        "pagbiling ito?"
                    ),
                },
                suggested_values={},
            ),
        )

    txn_d = parse_date(extraction.txn_date)
    if not txn_d:
        return CheckResult(
            check_name="date_window",
            passed=False,
            details=f"Invalid transaction date format: {extraction.txn_date}",
            exception=VerificationException(
                kind="out_of_period",
                severity="warning",
                question_text=(
                    f"The transaction date '{extraction.txn_date}' is invalid."
                ),
                question_key="out_of_period_window",
                suggested_values={},
            ),
        )

    is_before_start = context.start_date is not None and txn_d < context.start_date
    is_after_end = context.end_date is not None and txn_d > context.end_date

    if is_before_start or is_after_end:
        params = {
            "txn_date": extraction.txn_date,
            "start_date": str(context.start_date or "N/A"),
            "end_date": str(context.end_date or "N/A"),
        }
        q_en, q_trans = get_question("out_of_period_window", params)
        return CheckResult(
            check_name="date_window",
            passed=False,
            details=(
                f"Transaction date ({extraction.txn_date}) is outside activity "
                f"range ({context.start_date} to {context.end_date})."
            ),
            exception=VerificationException(
                kind="out_of_period",
                severity="blocking",
                question_text=q_en,
                question_key="out_of_period_window",
                question_translations=q_trans,
                suggested_values={
                    "txn_date": extraction.txn_date,
                    "activity_start_date": str(context.start_date),
                    "activity_end_date": str(context.end_date),
                },
            ),
        )

    return CheckResult(check_name="date_window", passed=True)


def check_future_date(
    extraction: ReceiptExtraction,
    context: ActivityContext,
) -> CheckResult:
    """Verifies that transaction date is not set in the future."""
    if not extraction.txn_date:
        return CheckResult(check_name="future_date", passed=True)

    txn_d = parse_date(extraction.txn_date)
    if not txn_d:
        return CheckResult(check_name="future_date", passed=True)

    if txn_d > context.today:
        params = {"txn_date": extraction.txn_date}
        q_en, q_trans = get_question("out_of_period_future", params)
        return CheckResult(
            check_name="future_date",
            passed=False,
            details=(
                f"Transaction date ({extraction.txn_date}) is in the future "
                f"(today is {context.today})."
            ),
            exception=VerificationException(
                kind="out_of_period",
                severity="blocking",
                question_text=q_en,
                question_key="out_of_period_future",
                question_translations=q_trans,
                suggested_values={
                    "txn_date": extraction.txn_date,
                    "today": str(context.today),
                },
            ),
        )

    return CheckResult(check_name="future_date", passed=True)


def check_or_number_format(extraction: ReceiptExtraction) -> CheckResult:
    """Verifies that OR or SI number is present and plausible."""
    if not extraction.or_number or len(extraction.or_number.strip()) < 2:
        q_en, q_trans = get_question("missing_doc_or_number")
        return CheckResult(
            check_name="or_number_format",
            passed=False,
            details=("Official Receipt or Sales Invoice number is missing or empty."),
            exception=VerificationException(
                kind="missing_doc",
                severity="warning",
                question_text=q_en,
                question_key="missing_doc_or_number",
                question_translations=q_trans,
                suggested_values={},
            ),
        )

    return CheckResult(check_name="or_number_format", passed=True)


def check_confidence(
    extraction: ReceiptExtraction,
    min_soft_flag: float = 0.70,
) -> CheckResult:
    """Verifies overall extraction confidence meets minimum threshold."""
    if extraction.confidence < min_soft_flag:
        params = {"confidence_pct": f"{int(extraction.confidence * 100)}%"}
        q_en, q_trans = get_question("low_confidence", params)
        return CheckResult(
            check_name="confidence",
            passed=False,
            details=(
                f"Extraction confidence ({extraction.confidence:.2f}) is "
                f"below {min_soft_flag:.2f}."
            ),
            exception=VerificationException(
                kind="low_confidence",
                severity="blocking",
                question_text=q_en,
                question_key="low_confidence",
                question_translations=q_trans,
                suggested_values={"extracted_confidence": extraction.confidence},
            ),
        )

    return CheckResult(check_name="confidence", passed=True)
