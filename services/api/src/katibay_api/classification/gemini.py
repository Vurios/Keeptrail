"""Gemini fallback classifier strictly constrained to budget categories."""

import json
import logging
from collections.abc import Sequence

from pydantic import BaseModel, Field

from katibay_api.classification.models import (
    CategoryClassificationResult,
    ClassificationSource,
)
from katibay_api.config import settings
from katibay_api.extraction.extractor import (
    GeminiClientProtocol,
    get_gemini_client,
)
from katibay_api.verification.models import VerificationException

logger = logging.getLogger("katibay_api.classification.gemini")


class GeminiCategoryDecision(BaseModel):
    """Structured response schema for category classification."""

    category: str = Field(
        ...,
        description="The chosen budget category from the provided allowed list",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence in this classification (0.0 to 1.0)",
    )
    rationale: str = Field(
        default="",
        description="Short reasoning for selecting this category",
    )


def build_classification_prompt(
    merchant_name: str,
    line_items: Sequence[str],
    allowed_categories: Sequence[str],
) -> str:
    categories_str = json.dumps(list(allowed_categories))
    items_str = ", ".join(line_items) if line_items else "No items listed"
    return f"""You are Katibay's accounting category classifier.

TASK:
Classify the following receipt into one of the allowed activity budget categories.

EVIDENCE:
- Merchant: {merchant_name}
- Line Items: {items_str}

ALLOWED BUDGET CATEGORIES (Strict Requirement):
{categories_str}

STRICT CONSTRAINTS:
1. You MUST choose ONLY from the allowed budget categories listed above.
2. Never invent, extrapolate, or suggest any category not in the allowed list.
3. If the merchant/items do not clearly match any allowed category with high \
certainty, provide confidence below 0.70.
4. Output valid JSON matching schema: 'category', 'confidence', 'rationale'.
"""


async def classify_with_gemini(
    merchant_name: str | None,
    allowed_categories: Sequence[str],
    line_items: Sequence[str] = (),
    client: GeminiClientProtocol | None = None,
    min_confidence: float = 0.75,
    model_id: str = settings.gemini_model_id,
    api_key: str = settings.gemini_api_key,
) -> CategoryClassificationResult:
    """Classifies a receipt against allowed categories using Gemini."""
    if not allowed_categories:
        q_en = (
            "No budget categories are defined for this activity. "
            "Please set up budget lines first."
        )
        q_fil = (
            "Walang mga kategorya ng badyet na nakatakda para sa " "aktibidad na ito."
        )
        return CategoryClassificationResult(
            category=None,
            confidence=0.0,
            source=ClassificationSource.FALLBACK,
            rationale="No budget categories configured for this activity.",
            exception=VerificationException(
                kind="low_confidence",
                severity="blocking",
                question_text=q_en,
                question_key="low_confidence",
                question_translations={
                    "en": q_en,
                    "fil": q_fil,
                },
                suggested_values={},
            ),
        )

    clean_merchant = merchant_name or "Unknown Merchant"
    prompt = build_classification_prompt(clean_merchant, line_items, allowed_categories)
    gemini_client = client or get_gemini_client()

    allowed_map = {cat.lower(): cat for cat in allowed_categories}

    try:
        raw_text = await gemini_client.generate_structured_content(
            image_bytes=b"",
            mime_type="text/plain",
            prompt=prompt,
            model_id=model_id,
            api_key=api_key,
        )
        data = json.loads(raw_text)
        decision = GeminiCategoryDecision.model_validate(data)

        canonical_category = allowed_map.get(decision.category.lower())

        if not canonical_category:
            logger.warning(
                "Gemini returned invalid category '%s' not in %s",
                decision.category,
                allowed_categories,
            )
            return _create_low_confidence_result(
                confidence=0.0,
                allowed_categories=allowed_categories,
                reason=(
                    f"Model suggested invalid category '{decision.category}' "
                    f"not in budget lines."
                ),
            )

        if decision.confidence < min_confidence:
            return _create_low_confidence_result(
                confidence=decision.confidence,
                allowed_categories=allowed_categories,
                suggested_category=canonical_category,
                reason=(
                    f"Classification confidence ({decision.confidence:.2f}) "
                    f"is below {min_confidence:.2f}."
                ),
            )

        return CategoryClassificationResult(
            category=canonical_category,
            confidence=decision.confidence,
            source=ClassificationSource.GEMINI,
            rationale=decision.rationale,
        )

    except Exception as exc:
        logger.exception("Error during Gemini category classification: %s", exc)
        return _create_low_confidence_result(
            confidence=0.0,
            allowed_categories=allowed_categories,
            reason=f"Classification error: {exc!s}",
        )


def _create_low_confidence_result(
    confidence: float,
    allowed_categories: Sequence[str],
    suggested_category: str | None = None,
    reason: str | None = None,
) -> CategoryClassificationResult:
    question_en = "Which budget category should this expense be allocated to?"
    question_fil = "Sa aling kategorya ng badyet dapat ilaan ang gastusing ito?"
    return CategoryClassificationResult(
        category=suggested_category,
        confidence=confidence,
        source=ClassificationSource.FALLBACK,
        rationale=reason,
        exception=VerificationException(
            kind="low_confidence",
            severity="blocking",
            question_text=question_en,
            question_key="low_confidence",
            question_translations={
                "en": question_en,
                "fil": question_fil,
            },
            suggested_values={
                "available_categories": list(allowed_categories),
                "suggested_category": suggested_category,
                "confidence": confidence,
            },
        ),
    )
