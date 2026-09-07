"""Deterministic rules layer for merchant category classification."""

import re
from collections.abc import Sequence

from katibay_api.classification.models import (
    CategoryClassificationResult,
    ClassificationSource,
    MerchantRule,
)


def match_rule(merchant_name: str, pattern: str) -> bool:
    """Tests if a merchant name matches a given regex or case-insensitive pattern."""
    if not merchant_name or not pattern:
        return False
    try:
        # Try full regex search with IGNORECASE
        return bool(re.search(pattern, merchant_name, re.IGNORECASE))
    except re.error:
        # Fallback to simple substring match
        return pattern.lower() in merchant_name.lower()


def classify_by_rules(
    merchant_name: str | None,
    allowed_categories: Sequence[str],
    rules: Sequence[MerchantRule],
) -> CategoryClassificationResult | None:
    """Evaluates rules against merchant name.

    Only returns a match if the matched category is in allowed_categories.
    """
    if not merchant_name:
        return None

    # Normalize allowed categories for case-insensitive lookup
    allowed_map = {cat.lower(): cat for cat in allowed_categories}

    for rule in rules:
        if match_rule(merchant_name, rule.pattern):
            canonical_cat = allowed_map.get(rule.category.lower())
            if canonical_cat is not None:
                return CategoryClassificationResult(
                    category=canonical_cat,
                    confidence=1.0,
                    source=ClassificationSource.RULE,
                    rule_matched=rule.pattern,
                    rationale=f"Matched merchant rule: '{rule.pattern}'",
                )

    return None
