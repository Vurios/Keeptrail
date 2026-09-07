"""Tests for the image preprocessing module."""

from PIL import Image

from katibay_api.duplicates import compute_hamming_distance
from katibay_api.preprocessing import (
    downscale_long_edge,
    preprocess_receipt_image,
)
from tests.helpers import create_synthetic_pdf, create_synthetic_receipt


def test_preprocessing_downscales_large_image():
    """Images with long edge > 1600px are downscaled so the long edge is 1600px."""
    large_img = Image.new("RGB", (2000, 3000), color=(255, 255, 255))
    resized = downscale_long_edge(large_img, max_long_edge=1600)
    assert max(resized.size) == 1600
    assert resized.size == (1067, 1600)


def test_preprocessing_preserves_smaller_image():
    """Images with long edge <= 1600px are not upscaled."""
    small_img = Image.new("RGB", (800, 1200), color=(255, 255, 255))
    resized = downscale_long_edge(small_img, max_long_edge=1600)
    assert resized.size == (800, 1200)


def test_preprocessing_jpeg_pipeline():
    """Validates full pipeline on JPEG bytes."""
    raw_bytes = create_synthetic_receipt()
    result = preprocess_receipt_image(raw_bytes, mime_type="image/jpeg")

    assert len(result.normalized_jpeg_bytes) > 0
    assert result.normalized_jpeg_bytes[:3] == b"\xff\xd8\xff"  # JPEG magic bytes
    assert max(result.width, result.height) <= 1600
    assert len(result.phash) == 16  # 64-bit hex hash


def test_preprocessing_pdf_pipeline():
    """Validates PDF first-page rendering and preprocessing."""
    pdf_bytes = create_synthetic_pdf()
    result = preprocess_receipt_image(pdf_bytes, mime_type="application/pdf")

    assert len(result.normalized_jpeg_bytes) > 0
    assert result.phash is not None
    assert len(result.phash) == 16


def test_rotated_rephotograph_perceptual_hash_similarity():
    """Acceptance Criteria:

    A rotated re-photograph (or slightly skewed capture) of the same receipt
    produces a perceptual hash within Hamming distance <= 5.
    """
    text = (
        "JOLLIBEE FOODS CORP\n"
        "CHICKENJOY 2PC: 180.00\n"
        "EXTRA RICE: 35.00\n"
        "TOTAL: PHP 215.00"
    )
    original_bytes = create_synthetic_receipt(text=text, rotation_angle_deg=0.0)
    rotated_bytes = create_synthetic_receipt(
        text=text, rotation_angle_deg=3.5, contrast_offset=-10
    )

    res_orig = preprocess_receipt_image(original_bytes)
    res_rotated = preprocess_receipt_image(rotated_bytes)

    dist = compute_hamming_distance(res_orig.phash, res_rotated.phash)
    assert dist <= 5, f"Expected Hamming distance <= 5 for rotated receipt, got {dist}"


def test_distinct_receipts_have_large_hamming_distance():
    """Two completely different receipts produce distant hashes (Hamming > 5)."""
    receipt_1 = create_synthetic_receipt(
        text="SM STORE\nSHIRT: PHP 999.00\nSHOES: PHP 2500.00"
    )
    receipt_2 = create_synthetic_receipt(
        text="MERCURY DRUG\nBIOGESIC: PHP 8.00\nNEOZEP: PHP 12.00"
    )

    res_1 = preprocess_receipt_image(receipt_1)
    res_2 = preprocess_receipt_image(receipt_2)

    dist = compute_hamming_distance(res_1.phash, res_2.phash)
    assert dist > 5, f"Expected distinct receipts to have distance > 5, got {dist}"
