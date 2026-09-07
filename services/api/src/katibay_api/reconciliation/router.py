"""FastAPI router for activity budget reconciliation."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from katibay_api.auth import AuthenticatedUser, get_current_user
from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.reconciliation.engine import compute_reconciliation
from katibay_api.reconciliation.models import (
    ActivityReconciliation,
    BudgetLineItem,
    ExpenseRecord,
)

router = APIRouter(prefix="/activities", tags=["Reconciliation"])


@router.get("/{id}/reconciliation", response_model=ActivityReconciliation)
async def get_activity_reconciliation(
    id: Annotated[uuid.UUID, Path(description="Activity UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> ActivityReconciliation:
    """Computes and returns full category budget and cash advance reconciliation."""
    # Look up activity
    activity = await db.get_activity(id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity {id} was not found.",
        )

    # Check workspace membership
    workspace_id = activity["workspace_id"]
    user_role = user.role_in(workspace_id)
    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: User is not a member of workspace {workspace_id}.",
        )

    # Fetch budget lines for this activity
    budget_lines_raw = await db.get_budget_lines(id)
    budget_lines = [
        BudgetLineItem(
            id=bl["id"],
            category=bl["category"],
            approved_amount=bl["approved_amount"],
            notes=bl.get("notes"),
        )
        for bl in budget_lines_raw
    ]

    # Fetch approved/verified receipts for this activity
    receipts_raw = await db.get_activity_receipts(id)
    expenses: list[ExpenseRecord] = []
    for r in receipts_raw:
        # Check line items or receipt total
        category = r.get("category") or "General"
        amount = r.get("total_amount") or 0
        expenses.append(
            ExpenseRecord(
                receipt_id=r["id"],
                category=category,
                amount=amount,
                merchant_name=r.get("merchant_name"),
                txn_date=str(r.get("txn_date")) if r.get("txn_date") else None,
            )
        )

    reconciliation = compute_reconciliation(
        activity_id=id,
        title=activity.get("title", "Activity"),
        cash_advance_amount=activity.get("cash_advance_amount", 0),
        budget_lines=budget_lines,
        expenses=expenses,
    )

    return reconciliation
