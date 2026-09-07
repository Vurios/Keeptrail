"""Scheduled warranty expiry checker and notification engine."""

import logging
from datetime import date
from typing import Any

from katibay_api.db import DatabaseRepository, get_db_repository

logger = logging.getLogger("katibay_api.passports.scheduler")


async def check_passport_expiries(
    reference_date: date | None = None,
    db_repo: DatabaseRepository | None = None,
) -> list[dict[str, Any]]:
    """Checks passport warranties and fires notifications at 60, 30, 7 days.

    Args:
        reference_date: Today's date to evaluate against (defaults to date.today()).
        db_repo: Optional database repository override.

    Returns:
        List of generated expiry notification dicts.
    """
    repo = db_repo or get_db_repository()
    ref_date = reference_date or date.today()
    notifications: list[dict[str, Any]] = []

    # Get all passports across all workspaces (in memory repo or query)
    if hasattr(repo, "passports"):
        passports = repo.passports
    else:
        # asyncpg fallback for active / expiring items
        pool = await repo.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, workspace_id, receipt_id, item_name, brand, model,
                   serial_number, purchase_date, warranty_months,
                   warranty_expires_at, coverage_notes, status::text
            FROM public.passports
            WHERE status IN ('active', 'expiring')
            """
        )
        passports = [dict(r) for r in rows]

    for p in passports:
        expires_at = p.get("warranty_expires_at")
        if isinstance(expires_at, str):
            exp_date = date.fromisoformat(expires_at)
        else:
            exp_date = expires_at

        if not exp_date:
            continue

        days_remaining = (exp_date - ref_date).days
        item_name = p.get("item_name", "Asset")
        passport_id = p["id"]

        tier: str | None = None
        new_status: str | None = None
        message: str = ""

        if days_remaining <= 0:
            tier = "expired"
            new_status = "expired"
            message = f"Warranty for {item_name} expired on {exp_date}."
        elif days_remaining <= 7:
            tier = "critical_7d"
            new_status = "expiring"
            message = (
                f"CRITICAL: Warranty for {item_name} expires in "
                f"{days_remaining} days on {exp_date}."
            )
        elif days_remaining <= 30:
            tier = "warning_30d"
            new_status = "expiring"
            message = (
                f"WARNING: Warranty for {item_name} expires in "
                f"{days_remaining} days on {exp_date}."
            )
        elif days_remaining <= 60:
            tier = "notice_60d"
            new_status = "expiring"
            message = (
                f"NOTICE: Warranty for {item_name} expires in "
                f"{days_remaining} days on {exp_date}."
            )
        else:
            new_status = "active"

        if new_status and p.get("status") != new_status:
            await repo.update_passport_status(passport_id, new_status)

        if tier:
            notification = {
                "passport_id": passport_id,
                "item_name": item_name,
                "days_remaining": days_remaining,
                "tier": tier,
                "message": message,
                "warranty_expires_at": str(exp_date),
            }
            notifications.append(notification)

            # Record audit event
            await repo.insert_audit_event(
                workspace_id=p["workspace_id"],
                actor_id=None,
                entity_type="passport",
                entity_id=passport_id,
                action="passport.expiry_notification",
                before={"status": p.get("status")},
                after={
                    "status": new_status,
                    "tier": tier,
                    "days_remaining": days_remaining,
                },
            )

    return notifications
