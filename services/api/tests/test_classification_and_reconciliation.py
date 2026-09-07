"""Acceptance tests for Prompt 8: Classification and Reconciliation."""

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from katibay_api.classification.models import (
    ClassificationSource,
    MerchantRule,
)
from katibay_api.classification.service import classify_merchant
from katibay_api.db import InMemoryRepository, set_db_repository
from katibay_api.extraction.extractor import MockGeminiClient
from katibay_api.main import app
from katibay_api.reconciliation import (
    ActivityReconciliation,
    BudgetLineItem,
    ExpenseRecord,
    compute_reconciliation,
)
from tests.test_auth_and_middleware import generate_jwt

client = TestClient(app)

ALLOWED_CATEGORIES = [
    "Food & Catering",
    "Transportation",
    "Materials",
    "Printing",
    "Prizes & Awards",
]


# ===========================================================================
# 1. Category Classification Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_classification_rule_layer_match():
    """Tier 1: Matches merchant rule pattern deterministically."""
    workspace_id = uuid.uuid4()
    rules = [
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern=r"(?i)jollibee|mcdonalds|kfc",
            category="Food & Catering",
        ),
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern=r"(?i)shell|petron|grab",
            category="Transportation",
        ),
    ]

    result = await classify_merchant(
        merchant_name="Jollibee Katipunan",
        allowed_categories=ALLOWED_CATEGORIES,
        rules=rules,
    )

    assert result.category == "Food & Catering"
    assert result.confidence == 1.0
    assert result.source == ClassificationSource.RULE
    assert result.exception is None


@pytest.mark.asyncio
async def test_classification_gemini_fallback_success():
    """Tier 2: Falls back to Gemini when no rule matches."""
    workspace_id = uuid.uuid4()
    rules = [
        MerchantRule(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            pattern=r"(?i)shell",
            category="Transportation",
        )
    ]

    mock_gemini_response = json.dumps(
        {
            "category": "Printing",
            "confidence": 0.95,
            "rationale": "Tarpaulins and flyer printing.",
        }
    )
    mock_client = MockGeminiClient(canned_response_text=mock_gemini_response)

    result = await classify_merchant(
        merchant_name="National Book Store Printing Services",
        allowed_categories=ALLOWED_CATEGORIES,
        rules=rules,
        line_items=["Event tarpaulin printing 4x6"],
        client=mock_client,
    )

    assert result.category == "Printing"
    assert result.confidence == 0.95
    assert result.source == ClassificationSource.GEMINI
    assert result.exception is None


@pytest.mark.asyncio
async def test_classification_low_confidence_produces_exception():
    """Confidence below 0.75 produces a low_confidence exception."""
    mock_gemini_response = json.dumps(
        {
            "category": "Materials",
            "confidence": 0.60,  # Below 0.75 threshold
            "rationale": "Unclear invoice description.",
        }
    )
    mock_client = MockGeminiClient(canned_response_text=mock_gemini_response)

    result = await classify_merchant(
        merchant_name="Unknown Corner Store",
        allowed_categories=ALLOWED_CATEGORIES,
        client=mock_client,
    )

    assert result.source == ClassificationSource.FALLBACK
    assert result.exception is not None
    assert result.exception.kind == "low_confidence"
    assert result.exception.severity == "blocking"
    assert "Which budget category" in result.exception.question_text
    assert "available_categories" in result.exception.suggested_values


@pytest.mark.asyncio
async def test_classification_invalid_category_from_gemini_produces_exception():
    """Gemini returning invalid category is rejected and produces exception."""
    mock_gemini_response = json.dumps(
        {
            "category": "Office Supplies & Software",
            "confidence": 0.99,
            "rationale": "Software tools.",
        }
    )
    mock_client = MockGeminiClient(canned_response_text=mock_gemini_response)

    result = await classify_merchant(
        merchant_name="Adobe Creative Cloud",
        allowed_categories=ALLOWED_CATEGORIES,
        client=mock_client,
    )

    assert result.exception is not None
    assert result.exception.kind == "low_confidence"


# ===========================================================================
# 2. Budget Reconciliation Tests (Integer Centavos)
# ===========================================================================


def test_reconciliation_exact_budget():
    """Acceptance: Spend exactly matches approved amounts and cash advance."""
    activity_id = uuid.uuid4()
    cash_advance = 3000000  # ₱30,000.00

    budget_lines = [
        BudgetLineItem(category="Food & Catering", approved_amount=800000),
        BudgetLineItem(category="Transportation", approved_amount=500000),
        BudgetLineItem(category="Materials", approved_amount=900000),
        BudgetLineItem(category="Printing", approved_amount=400000),
        BudgetLineItem(category="Prizes & Awards", approved_amount=400000),
    ]

    expenses = [
        ExpenseRecord(category="Food & Catering", amount=800000),
        ExpenseRecord(category="Transportation", amount=500000),
        ExpenseRecord(category="Materials", amount=900000),
        ExpenseRecord(category="Printing", amount=400000),
        ExpenseRecord(category="Prizes & Awards", amount=400000),
    ]

    rec: ActivityReconciliation = compute_reconciliation(
        activity_id=activity_id,
        title="O-Week 2026",
        cash_advance_amount=cash_advance,
        budget_lines=budget_lines,
        expenses=expenses,
    )

    assert rec.total_approved == 3000000
    assert rec.total_actual_spend == 3000000
    assert rec.net_balance == 0
    assert rec.excess_to_return == 0
    assert rec.total_overage == 0
    assert rec.is_over_cash_advance is False
    assert rec.has_over_budget_categories is False
    assert len(rec.exceptions) == 0


def test_reconciliation_under_budget():
    """Acceptance: Total spend is under cash advance -> excess to return."""
    activity_id = uuid.uuid4()
    cash_advance = 3000000  # ₱30,000.00

    budget_lines = [
        BudgetLineItem(category="Food & Catering", approved_amount=800000),
        BudgetLineItem(category="Transportation", approved_amount=500000),
        BudgetLineItem(category="Materials", approved_amount=900000),
        BudgetLineItem(category="Printing", approved_amount=400000),
        BudgetLineItem(category="Prizes & Awards", approved_amount=400000),
    ]

    expenses = [
        ExpenseRecord(category="Food & Catering", amount=650000),
        ExpenseRecord(category="Transportation", amount=400000),
        ExpenseRecord(category="Materials", amount=700000),
        ExpenseRecord(category="Printing", amount=350000),
        ExpenseRecord(category="Prizes & Awards", amount=350000),
    ]

    rec: ActivityReconciliation = compute_reconciliation(
        activity_id=activity_id,
        title="O-Week 2026",
        cash_advance_amount=cash_advance,
        budget_lines=budget_lines,
        expenses=expenses,
    )

    expected_spend = 650000 + 400000 + 700000 + 350000 + 350000
    assert rec.total_actual_spend == expected_spend
    assert rec.net_balance == 550000  # ₱5,500.00
    assert rec.excess_to_return == 550000  # ₱5,500.00 to return
    assert rec.total_overage == 0
    assert rec.is_over_cash_advance is False
    assert rec.has_over_budget_categories is False
    assert len(rec.exceptions) == 0


def test_reconciliation_single_category_overage():
    """Acceptance: One category exceeds approved amount -> over_budget."""
    activity_id = uuid.uuid4()
    cash_advance = 3000000

    budget_lines = [
        BudgetLineItem(category="Food & Catering", approved_amount=800000),
        BudgetLineItem(category="Transportation", approved_amount=500000),
    ]

    expenses = [
        ExpenseRecord(category="Food & Catering", amount=1000000),
        ExpenseRecord(category="Transportation", amount=400000),
    ]

    rec: ActivityReconciliation = compute_reconciliation(
        activity_id=activity_id,
        title="O-Week 2026",
        cash_advance_amount=cash_advance,
        budget_lines=budget_lines,
        expenses=expenses,
    )

    assert rec.has_over_budget_categories is True
    food_cat = next(c for c in rec.categories if c.category == "Food & Catering")
    assert food_cat.is_over_budget is True
    assert food_cat.overage_amount == 200000
    assert food_cat.variance == -200000

    # Over budget exception created
    assert len(rec.exceptions) == 1
    exc = rec.exceptions[0]
    assert exc["kind"] == "over_budget"
    assert exc["severity"] == "blocking"
    assert "exceeding approved budget" in exc["question_text"]
    assert exc["suggested_values"]["overage_amount"] == 200000


def test_reconciliation_total_exceeding_cash_advance():
    """Acceptance: Total spend exceeds cash advance -> total_overage."""
    activity_id = uuid.uuid4()
    cash_advance = 3000000  # ₱30,000.00

    budget_lines = [
        BudgetLineItem(category="Food & Catering", approved_amount=1500000),
        BudgetLineItem(category="Materials", approved_amount=2000000),
    ]

    expenses = [
        ExpenseRecord(category="Food & Catering", amount=1500000),
        ExpenseRecord(category="Materials", amount=2000000),
    ]

    rec: ActivityReconciliation = compute_reconciliation(
        activity_id=activity_id,
        title="O-Week 2026",
        cash_advance_amount=cash_advance,
        budget_lines=budget_lines,
        expenses=expenses,
    )

    assert rec.total_actual_spend == 3500000
    assert rec.is_over_cash_advance is True
    assert rec.total_overage == 500000  # ₱5,000.00
    assert rec.excess_to_return == 0

    ca_exc = next(
        e for e in rec.exceptions if e["question_key"] == "over_budget_cash_advance"
    )
    assert ca_exc["suggested_values"]["total_overage"] == 500000


# ===========================================================================
# 3. GET /activities/{id}/reconciliation API Endpoint Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_get_activity_reconciliation_endpoint():
    """API endpoint returns 200 OK with full reconciliation payload."""
    mock_db = InMemoryRepository()
    set_db_repository(mock_db)

    user_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    activity_id = uuid.uuid4()

    mock_db.activities.append(
        {
            "id": activity_id,
            "workspace_id": workspace_id,
            "title": "Orientation 2026",
            "cash_advance_amount": 3000000,
            "start_date": "2026-08-01",
            "end_date": "2026-08-31",
            "status": "collecting",
        }
    )

    mock_db.budget_lines.extend(
        [
            {
                "id": uuid.uuid4(),
                "activity_id": activity_id,
                "category": "Food & Catering",
                "approved_amount": 800000,
            },
            {
                "id": uuid.uuid4(),
                "activity_id": activity_id,
                "category": "Transportation",
                "approved_amount": 500000,
            },
        ]
    )

    token = generate_jwt(
        user_id=user_id,
        memberships={str(workspace_id): "treasurer"},
    )

    response = client.get(
        f"/activities/{activity_id}/reconciliation",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["activity_id"] == str(activity_id)
    assert data["cash_advance_amount"] == 3000000
    assert data["total_approved"] == 1300000
    assert len(data["categories"]) == 2
