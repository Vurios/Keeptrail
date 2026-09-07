"""Acceptance and golden-file tests for Prompt 6: Gemini Receipt Extraction."""

import json
from pathlib import Path

import pytest

from katibay_api.extraction.extractor import (
    MockGeminiClient,
    extract_receipt_from_image,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "receipts"


@pytest.mark.asyncio
async def test_extraction_successful_with_recorded_fixture():
    """Extracts valid structured receipt data from mock Gemini client."""
    fixture_file = FIXTURES_DIR / "receipt_001_jollibee.json"
    with open(fixture_file, encoding="utf-8") as f:
        fixture_json_text = f.read()

    mock_client = MockGeminiClient(canned_response_text=fixture_json_text)
    fake_image_bytes = b"fake-jpeg-binary-data"

    result = await extract_receipt_from_image(
        image_bytes=fake_image_bytes,
        client=mock_client,
        model_id="gemini-2.0-flash",
    )

    assert result.is_exception is False
    assert result.extraction is not None
    assert result.model_version == "gemini-2.0-flash"

    ext = result.extraction
    assert ext.merchant_name == "Jollibee Foods Corporation"
    assert ext.merchant_tin == "000-123-456-000"
    assert ext.total_amount == 58000  # ₱580.00 in integer centavos
    assert len(ext.line_items) == 3
    assert ext.line_items[0].line_total == 37000
    assert ext.confidence >= 0.90


@pytest.mark.asyncio
async def test_extraction_transient_error_retry_success():
    """Retries once on transient error and succeeds on 2nd attempt."""
    fixture_file = FIXTURES_DIR / "receipt_002_mercury_drug.json"
    with open(fixture_file, encoding="utf-8") as f:
        fixture_json_text = f.read()

    mock_client = MockGeminiClient(canned_response_text=fixture_json_text)
    # Simulate 1 transient failure before succeeding
    mock_client.transient_fail_count = 1

    result = await extract_receipt_from_image(
        image_bytes=b"fake-bytes",
        client=mock_client,
    )

    assert result.is_exception is False
    assert result.extraction is not None
    assert result.extraction.merchant_name == "Mercury Drug Corporation"
    assert mock_client.call_count == 2


@pytest.mark.asyncio
async def test_extraction_malformed_json_produces_low_confidence_exception():
    """Malformed JSON response from model produces low_confidence exception."""
    mock_client = MockGeminiClient(canned_response_text="Not valid JSON at all")

    result = await extract_receipt_from_image(
        image_bytes=b"fake-bytes",
        client=mock_client,
    )

    assert result.is_exception is True
    assert result.exception_kind == "low_confidence"
    assert "Malformed JSON" in (result.exception_reason or "")
    assert result.extraction is None


@pytest.mark.asyncio
async def test_extraction_model_refusal_produces_low_confidence_exception():
    """Model refusal (e.g. Safety filter) produces low_confidence exception."""
    mock_client = MockGeminiClient()  # No response configured -> triggers exception

    result = await extract_receipt_from_image(
        image_bytes=b"fake-bytes",
        client=mock_client,
    )

    assert result.is_exception is True
    assert result.exception_kind == "low_confidence"
    assert result.extraction is None


@pytest.mark.asyncio
async def test_golden_file_suite_and_field_accuracy():
    """Acceptance Criteria:

    Golden-file test runs against fixtures and prints per-field accuracy.
    """
    fixture_files = list(FIXTURES_DIR.glob("*.json"))
    assert len(fixture_files) >= 4, "Expected at least 4 golden receipt fixtures."

    fields_to_track = [
        "merchant_name",
        "merchant_tin",
        "merchant_address",
        "txn_date",
        "txn_time",
        "or_number",
        "subtotal",
        "vat_amount",
        "total_amount",
        "payment_method",
        "line_items",
    ]

    field_scores: dict[str, list[bool]] = {f: [] for f in fields_to_track}

    for fix_path in fixture_files:
        with open(fix_path, encoding="utf-8") as f:
            raw_text = f.read()
            expected_dict = json.loads(raw_text)

        mock_client = MockGeminiClient(canned_response_text=raw_text)
        result = await extract_receipt_from_image(
            image_bytes=b"test-bytes",
            client=mock_client,
        )

        assert result.is_exception is False
        assert result.extraction is not None

        extracted_dict = result.extraction.model_dump()

        for field in fields_to_track:
            expected_val = expected_dict.get(field)
            actual_val = extracted_dict.get(field)

            if field == "line_items":
                is_match = len(actual_val) == len(expected_val)
            else:
                is_match = expected_val == actual_val

            field_scores[field].append(is_match)

    # Compute and print per-field accuracy table
    print("\n" + "=" * 55)
    print("KATIBAY GOLDEN-FILE EXTRACTION ACCURACY REPORT")
    print("=" * 55)
    print(f"{'Field':<25} | {'Matched':<10} | {'Accuracy':<10}")
    print("-" * 55)

    for field, results in field_scores.items():
        matched = sum(results)
        total = len(results)
        acc = (matched / total) * 100.0
        print(f"{field:<25} | {f'{matched}/{total}':<10} | {acc:>6.1f}%")
        assert acc == 100.0, f"Field '{field}' accuracy was {acc}%, expected 100%"

    print("=" * 55)
