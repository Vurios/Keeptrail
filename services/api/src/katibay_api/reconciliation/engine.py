"""Pure reconciliation engine operating strictly in integer centavos."""

import uuid
from collections import defaultdict
from collections.abc import Sequence

from katibay_api.reconciliation.models import (
    ActivityReconciliation,
    BudgetLineItem,
    CategoryReconciliation,
    ExpenseRecord,
)
from katibay_api.verification.translations import format_centavos_peso


def compute_reconciliation(
    activity_id: uuid.UUID,
    title: str,
    cash_advance_amount: int,
    budget_lines: Sequence[BudgetLineItem],
    expenses: Sequence[ExpenseRecord],
) -> ActivityReconciliation:
    """Computes budget line and cash advance reconciliation in centavos."""
    # 1. Aggregate actual spending per category
    actual_by_category: dict[str, int] = defaultdict(int)
    for exp in expenses:
        actual_by_category[exp.category] += exp.amount

    # 2. Process configured budget lines
    categories_result: list[CategoryReconciliation] = []
    exceptions: list[dict] = []
    processed_categories: set[str] = set()
    has_over_budget = False

    for bl in budget_lines:
        cat = bl.category
        processed_categories.add(cat.lower())

        approved = bl.approved_amount
        actual = actual_by_category.get(cat, 0)
        # Check case-insensitive variant if exact match not found
        if actual == 0:
            for exp_cat, exp_amt in actual_by_category.items():
                if (
                    exp_cat.lower() == cat.lower()
                    and exp_cat.lower() not in processed_categories
                ):
                    actual = exp_amt
                    processed_categories.add(exp_cat.lower())
                    break

        variance = approved - actual
        is_over = actual > approved
        overage = max(0, actual - approved)

        if is_over:
            has_over_budget = True
            q_en = (
                f"The category '{cat}' spent ₱{format_centavos_peso(actual)}, "
                f"exceeding approved budget of "
                f"₱{format_centavos_peso(approved)} by "
                f"₱{format_centavos_peso(overage)}. "
                f"How should this overage be handled?"
            )
            q_fil = (
                f"Ang kategoryang '{cat}' ay gumastos ng "
                f"₱{format_centavos_peso(actual)}, na lumampas sa "
                f"aprubadong badyet na ₱{format_centavos_peso(approved)} "
                f"ng ₱{format_centavos_peso(overage)}. Paano ito tutugunan?"
            )
            exceptions.append(
                {
                    "kind": "over_budget",
                    "severity": "blocking",
                    "question_text": q_en,
                    "question_key": "over_budget_category",
                    "question_translations": {"en": q_en, "fil": q_fil},
                    "suggested_values": {
                        "category": cat,
                        "approved_amount": approved,
                        "actual_amount": actual,
                        "overage_amount": overage,
                    },
                }
            )

        categories_result.append(
            CategoryReconciliation(
                category=cat,
                approved_amount=approved,
                actual_amount=actual,
                variance=variance,
                is_over_budget=is_over,
                overage_amount=overage,
            )
        )

    # 3. Handle unbudgeted categories present in expenses
    for exp_cat, exp_amt in actual_by_category.items():
        if exp_cat.lower() not in processed_categories:
            has_over_budget = True
            overage = exp_amt
            q_en = (
                f"Expenses of ₱{format_centavos_peso(exp_amt)} were incurred "
                f"under unbudgeted category '{exp_cat}'. "
                f"How should this be classified?"
            )
            q_fil = (
                f"May gastusing ₱{format_centavos_peso(exp_amt)} sa hindi "
                f"nakatalagang kategorya na '{exp_cat}'. Paano ito uuriin?"
            )
            exceptions.append(
                {
                    "kind": "over_budget",
                    "severity": "blocking",
                    "question_text": q_en,
                    "question_key": "over_budget_category",
                    "question_translations": {"en": q_en, "fil": q_fil},
                    "suggested_values": {
                        "category": exp_cat,
                        "approved_amount": 0,
                        "actual_amount": exp_amt,
                        "overage_amount": overage,
                    },
                }
            )
            categories_result.append(
                CategoryReconciliation(
                    category=exp_cat,
                    approved_amount=0,
                    actual_amount=exp_amt,
                    variance=-exp_amt,
                    is_over_budget=True,
                    overage_amount=overage,
                )
            )

    # 4. Total calculations across all expenditures
    total_approved = sum(bl.approved_amount for bl in budget_lines)
    total_actual_spend = sum(exp.amount for exp in expenses)
    net_balance = cash_advance_amount - total_actual_spend
    excess_to_return = max(0, net_balance)
    total_overage = max(0, total_actual_spend - cash_advance_amount)
    is_over_cash_advance = total_actual_spend > cash_advance_amount

    if is_over_cash_advance:
        q_en = (
            f"Total actual expenditures "
            f"(₱{format_centavos_peso(total_actual_spend)}) exceed cash advance "
            f"(₱{format_centavos_peso(cash_advance_amount)}) by "
            f"₱{format_centavos_peso(total_overage)}. "
            f"Please review reimbursement claims."
        )
        q_fil = (
            f"Ang kabuuang nagastos "
            f"(₱{format_centavos_peso(total_actual_spend)}) ay lumampas sa "
            f"cash advance (₱{format_centavos_peso(cash_advance_amount)}) "
            f"ng ₱{format_centavos_peso(total_overage)}. "
            f"Pakisuri ang mga reimbursement claim."
        )
        exceptions.append(
            {
                "kind": "over_budget",
                "severity": "blocking",
                "question_text": q_en,
                "question_key": "over_budget_cash_advance",
                "question_translations": {"en": q_en, "fil": q_fil},
                "suggested_values": {
                    "cash_advance_amount": cash_advance_amount,
                    "total_actual_spend": total_actual_spend,
                    "total_overage": total_overage,
                },
            }
        )

    return ActivityReconciliation(
        activity_id=activity_id,
        title=title,
        cash_advance_amount=cash_advance_amount,
        total_approved=total_approved,
        total_actual_spend=total_actual_spend,
        net_balance=net_balance,
        excess_to_return=excess_to_return,
        total_overage=total_overage,
        is_over_cash_advance=is_over_cash_advance,
        has_over_budget_categories=has_over_budget,
        categories=categories_result,
        exceptions=exceptions,
    )
