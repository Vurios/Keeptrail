"""Table-driven acceptance tests for Prompt 7: Receipt Verification."""

from datetime import date

import pytest

from katibay_api.extraction.schemas import ExtractedLineItem, ReceiptExtraction
from katibay_api.verification import (
    ActivityContext,
    VerificationReport,
    VerificationRouting,
    verify_receipt,
)


@pytest.fixture
def base_context() -> ActivityContext:
    return ActivityContext(
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 31),
        today=date(2026, 9, 1),
    )


def make_valid_extraction(
    total: int = 58000,
    subtotal: int = 51786,
    vat: int = 6214,
    txn_date: str = "2026-08-15",
    or_number: str = "OR-123456",
    confidence: float = 0.95,
    line_items: list[ExtractedLineItem] | None = None,
) -> ReceiptExtraction:
    if line_items is None:
        line_items = [
            ExtractedLineItem(
                description="Item A",
                qty=2.0,
                unit_price=18500,
                line_total=37000,
                confidence=0.98,
            ),
            ExtractedLineItem(
                description="Item B",
                qty=1.0,
                unit_price=14786,
                line_total=14786,
                confidence=0.97,
            ),
        ]
    return ReceiptExtraction(
        merchant_name="Test Store",
        merchant_tin="000-111-222-000",
        merchant_address="Katipunan Ave, QC",
        txn_date=txn_date,
        txn_time="12:30",
        or_number=or_number,
        line_items=line_items,
        subtotal=subtotal,
        vat_amount=vat,
        total_amount=total,
        payment_method="Cash",
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Table-Driven Test Matrix
# ---------------------------------------------------------------------------

TABLE_DRIVEN_SCENARIOS = [
    # 1. Matched Totals (Valid date, high confidence -> auto_approve)
    {
        "name": "matched_totals_auto_approve",
        "extraction": make_valid_extraction(
            total=58000,
            subtotal=51786,
            vat=6214,
            line_items=[
                ExtractedLineItem(
                    description="Item 1",
                    qty=1.0,
                    unit_price=37000,
                    line_total=37000,
                ),
                ExtractedLineItem(
                    description="Item 2",
                    qty=1.0,
                    unit_price=14786,
                    line_total=14786,
                ),
            ],
            confidence=0.96,
        ),
        "expected_routing": VerificationRouting.AUTO_APPROVE,
        "expected_passed": True,
        "expected_exception_kinds": [],
    },
    # 2. Off-by-one-centavo rounding (Diff <= 2 centavos -> passes)
    {
        "name": "off_by_one_centavo_rounding_tolerance",
        "extraction": make_valid_extraction(
            total=58001,  # 1 centavo difference
            subtotal=51786,
            vat=6214,
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.AUTO_APPROVE,
        "expected_passed": True,
        "expected_exception_kinds": [],
    },
    # 3. Transposed digit in total (e.g. ₱580.00 transcribed as ₱508.00)
    {
        "name": "transposed_digit_arithmetic_mismatch",
        "extraction": make_valid_extraction(
            total=50800,  # Transposed digits: 50800 vs 58000
            subtotal=51786,
            vat=6214,
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["arith_mismatch"],
    },
    # 4. Missing line item (Line items sum to 37000, but subtotal is 51786)
    {
        "name": "missing_line_item_arithmetic_mismatch",
        "extraction": make_valid_extraction(
            subtotal=51786,
            vat=6214,
            total=58000,
            line_items=[
                ExtractedLineItem(
                    description="Only Item 1",
                    qty=1.0,
                    unit_price=37000,
                    line_total=37000,
                )
            ],
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["arith_mismatch"],
    },
    # 5. Out-of-window date (txn_date July 15 is before activity start Aug 1)
    {
        "name": "out_of_window_date_before_start",
        "extraction": make_valid_extraction(
            txn_date="2026-07-15",
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["out_of_period"],
    },
    # 6. Out-of-window date (txn_date Sept 10 is after activity end Aug 31)
    {
        "name": "out_of_window_date_after_end",
        "extraction": make_valid_extraction(
            txn_date="2026-09-10",
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["out_of_period"],
    },
    # 7. Future date (txn_date Sept 15 is in future relative to today Sept 1)
    {
        "name": "future_date_exception",
        "extraction": make_valid_extraction(
            txn_date="2026-09-15",
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["out_of_period"],
    },
    # 8. Soft flag confidence (confidence 0.85 in [0.70, 0.92))
    {
        "name": "soft_flag_confidence_routing",
        "extraction": make_valid_extraction(
            confidence=0.85,
        ),
        "expected_routing": VerificationRouting.SOFT_FLAG,
        "expected_passed": True,
        "expected_exception_kinds": [],
    },
    # 9. Low confidence exception (confidence 0.60 < 0.70)
    {
        "name": "low_confidence_exception",
        "extraction": make_valid_extraction(
            confidence=0.60,
        ),
        "expected_routing": VerificationRouting.EXCEPTION,
        "expected_passed": False,
        "expected_exception_kinds": ["low_confidence"],
    },
    # 10. Missing OR Number (warning severity -> soft_flag)
    {
        "name": "missing_or_number_soft_flag",
        "extraction": make_valid_extraction(
            or_number="",
            confidence=0.95,
        ),
        "expected_routing": VerificationRouting.SOFT_FLAG,
        "expected_passed": False,
        "expected_exception_kinds": ["missing_doc"],
    },
]


@pytest.mark.parametrize("scenario", TABLE_DRIVEN_SCENARIOS, ids=lambda s: s["name"])
def test_table_driven_verification_scenarios(scenario, base_context):
    """Executes table-driven verification covering acceptance criteria."""
    report: VerificationReport = verify_receipt(
        extraction=scenario["extraction"],
        context=base_context,
    )

    assert report.routing == scenario["expected_routing"], (
        f"Failed {scenario['name']}: expected "
        f"{scenario['expected_routing']}, got {report.routing}"
    )
    assert report.passed == scenario["expected_passed"], (
        f"Failed {scenario['name']}: expected "
        f"passed={scenario['expected_passed']}, got {report.passed}"
    )

    actual_kinds = [exc.kind for exc in report.exceptions]
    for expected_kind in scenario["expected_exception_kinds"]:
        assert expected_kind in actual_kinds, (
            f"Failed {scenario['name']}: expected kind '{expected_kind}' "
            f"in {actual_kinds}"
        )


def test_verification_is_pure_and_never_mutates_extraction(base_context):
    """Rule verification: Pure functions never mutate extracted data."""
    original_extraction = make_valid_extraction()
    dump_before = original_extraction.model_dump()

    report = verify_receipt(original_extraction, base_context)

    dump_after = original_extraction.model_dump()
    assert (
        dump_before == dump_after
    ), "Extraction object was mutated during verification!"
    assert report is not None


def test_exceptions_contain_bilingual_translations(base_context):
    """Exceptions provide plain-language English and Filipino translation."""
    bad_extraction = make_valid_extraction(
        total=99999,  # Mismatched total
        subtotal=51786,
        vat=6214,
    )
    report = verify_receipt(bad_extraction, base_context)

    assert len(report.exceptions) > 0
    exc = report.exceptions[0]
    assert exc.question_text != ""
    assert "en" in exc.question_translations
    assert "fil" in exc.question_translations
    assert len(exc.question_translations["en"]) > 10
    assert len(exc.question_translations["fil"]) > 10
    assert exc.suggested_values != {}
