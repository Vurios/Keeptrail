"""Perceptual hash & exact-duplicate detection module."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

import imagehash

HAMMING_THRESHOLD = 5


@dataclass(frozen=True)
class ExistingReceiptCandidate:
    """Minimal receipt data required for duplicate matching."""

    id: uuid.UUID | str
    sha256: str
    perceptual_hash: str | None


@dataclass(frozen=True)
class DuplicateMatchResult:
    """Result of duplicate evaluation against existing workspace receipts."""

    is_duplicate: bool
    matched_receipt_id: uuid.UUID | str | None = None
    match_type: Literal["sha256", "phash"] | None = None
    hamming_distance: int | None = None


def compute_hamming_distance(hash1_hex: str, hash2_hex: str) -> int:
    """Calculates bitwise Hamming distance between two hex-encoded pHash strings."""
    h1 = imagehash.hex_to_hash(hash1_hex)
    h2 = imagehash.hex_to_hash(hash2_hex)
    return int(h1 - h2)


def evaluate_duplicate(
    target_sha256: str,
    target_phash: str,
    existing_candidates: Sequence[ExistingReceiptCandidate],
    threshold: int = HAMMING_THRESHOLD,
) -> DuplicateMatchResult:
    """Evaluates whether target matches any candidate by exact SHA-256 or
    pHash Hamming distance <= threshold.
    """

    for item in existing_candidates:
        if item.sha256.lower() == target_sha256.lower():
            return DuplicateMatchResult(
                is_duplicate=True,
                matched_receipt_id=item.id,
                match_type="sha256",
                hamming_distance=0,
            )

    # 2. Perceptual hash check within Hamming distance threshold
    best_dist = 999
    best_match_id = None

    for item in existing_candidates:
        if not item.perceptual_hash:
            continue
        try:
            dist = compute_hamming_distance(target_phash, item.perceptual_hash)
            if dist <= threshold and dist < best_dist:
                best_dist = dist
                best_match_id = item.id
        except Exception:
            continue

    if best_match_id is not None:
        return DuplicateMatchResult(
            is_duplicate=True,
            matched_receipt_id=best_match_id,
            match_type="phash",
            hamming_distance=best_dist,
        )

    return DuplicateMatchResult(is_duplicate=False)
