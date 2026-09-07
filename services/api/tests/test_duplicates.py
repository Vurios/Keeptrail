"""Tests for duplicate detection and Hamming distance calculations."""

import uuid

from katibay_api.duplicates import (
    ExistingReceiptCandidate,
    compute_hamming_distance,
    evaluate_duplicate,
)


def test_compute_hamming_distance():
    # Exactly same hash
    h1 = "d3e2a1c4b5f60718"
    assert compute_hamming_distance(h1, h1) == 0

    # 1 bit difference
    # 'd' (1101) vs 'f' (1111) = 1 bit diff
    h2 = "f3e2a1c4b5f60718"
    assert compute_hamming_distance(h1, h2) == 1


def test_evaluate_duplicate_exact_sha256():
    cand_id = uuid.uuid4()
    candidates = [
        ExistingReceiptCandidate(
            id=cand_id,
            sha256="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            perceptual_hash="1111222233334444",
        )
    ]

    # Exact SHA256 match
    result = evaluate_duplicate(
        target_sha256="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target_phash="9999888877776666",
        existing_candidates=candidates,
    )

    assert result.is_duplicate is True
    assert result.match_type == "sha256"
    assert result.matched_receipt_id == cand_id
    assert result.hamming_distance == 0


def test_evaluate_duplicate_perceptual_hash_within_5():
    cand_id = uuid.uuid4()
    # 2 bit difference hash
    base_hash = "d3e2a1c4b5f60718"
    similar_hash = "f3e2a1c4b5f60719"  # d->f (1 bit), 8->9 (1 bit) = 2 bits

    candidates = [
        ExistingReceiptCandidate(
            id=cand_id,
            sha256="different_sha256_hash_value_11111111111111111111111111111111111",
            perceptual_hash=base_hash,
        )
    ]

    result = evaluate_duplicate(
        target_sha256="new_target_sha256_hash_value_2222222222222222222222222222222",
        target_phash=similar_hash,
        existing_candidates=candidates,
        threshold=5,
    )

    assert result.is_duplicate is True
    assert result.match_type == "phash"
    assert result.matched_receipt_id == cand_id
    assert result.hamming_distance == 2


def test_evaluate_duplicate_not_matched():
    cand_id = uuid.uuid4()
    candidates = [
        ExistingReceiptCandidate(
            id=cand_id,
            sha256="existing_sha256_11111111111111111111111111111111111111111111111111",
            perceptual_hash="0000000000000000",
        )
    ]

    result = evaluate_duplicate(
        target_sha256="distinct_sha256_2222222222222222222222222222222222222222222222222",
        target_phash="ffffffffffffffff",  # 64 bits diff
        existing_candidates=candidates,
        threshold=5,
    )

    assert result.is_duplicate is False
    assert result.matched_receipt_id is None
    assert result.match_type is None
