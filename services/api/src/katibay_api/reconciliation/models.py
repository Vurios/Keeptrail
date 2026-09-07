"""Reconciliation models and schemas in integer centavos."""

import uuid
from typing import Any

from pydantic import BaseModel, Field


class BudgetLineItem(BaseModel):
    """Budget line with approved allocation in integer centavos."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    category: str
    approved_amount: int = Field(
        ge=0,
        description="Approved budget in integer centavos (e.g. ₱5,000 -> 500000)",
    )
    notes: str | None = None


class ExpenseRecord(BaseModel):
    """Actual expense allocated to a category."""

    receipt_id: uuid.UUID | None = None
    category: str
    amount: int = Field(ge=0, description="Expense amount in integer centavos")
    merchant_name: str | None = None
    txn_date: str | None = None


class CategoryReconciliation(BaseModel):
    """Reconciliation summary for a single budget category."""

    category: str
    approved_amount: int = Field(ge=0, description="Approved budget in centavos")
    actual_amount: int = Field(ge=0, description="Actual spend in centavos")
    variance: int = Field(description="approved_amount - actual_amount in centavos")
    is_over_budget: bool
    overage_amount: int = Field(
        ge=0, description="Excess spend over approved amount in centavos"
    )


class ActivityReconciliation(BaseModel):
    """Complete activity-level budget and cash advance reconciliation."""

    activity_id: uuid.UUID
    title: str
    cash_advance_amount: int = Field(
        ge=0, description="Cash advance issued in centavos"
    )
    total_approved: int = Field(
        ge=0, description="Sum of approved budget lines in centavos"
    )
    total_actual_spend: int = Field(
        ge=0, description="Total actual expenditures in centavos"
    )
    net_balance: int = Field(
        description="cash_advance_amount - total_actual_spend in centavos"
    )
    excess_to_return: int = Field(
        ge=0, description="Unspent cash advance to return in centavos"
    )
    total_overage: int = Field(
        ge=0, description="Amount spent beyond cash advance in centavos"
    )
    is_over_cash_advance: bool
    has_over_budget_categories: bool
    categories: list[CategoryReconciliation]
    exceptions: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of over_budget exceptions generated during reconciliation",
    )
