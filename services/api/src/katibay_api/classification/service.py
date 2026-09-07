"""Coordinated category classification service."""

from collections.abc import Sequence

from katibay_api.classification.gemini import classify_with_gemini
from katibay_api.classification.models import (
    CategoryClassificationResult,
    MerchantRule,
)
from katibay_api.classification.rules import classify_by_rules
from katibay_api.extraction.extractor import GeminiClientProtocol


async def classify_merchant(
    merchant_name: str | None,
    allowed_categories: Sequence[str],
    rules: Sequence[MerchantRule] = (),
    line_items: Sequence[str] = (),
    client: GeminiClientProtocol | None = None,
    min_confidence: float = 0.75,
) -> CategoryClassificationResult:
    """Classifies a receipt by first evaluating rules, then falling back to Gemini."""
    # 1. Tier 1: Rules layer first
    rule_result = classify_by_rules(
        merchant_name=merchant_name,
        allowed_categories=allowed_categories,
        rules=rules,
    )
    if rule_result is not None:
        return rule_result

    # 2. Tier 2: Gemini fallback (strictly constrained to allowed_categories)
    return await classify_with_gemini(
        merchant_name=merchant_name,
        allowed_categories=allowed_categories,
        line_items=line_items,
        client=client,
        min_confidence=min_confidence,
    )
