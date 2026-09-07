"""FastAPI router for exception filtering and resolution."""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, Field, field_validator

from katibay_api.auth import (
    AuthenticatedUser,
    assert_workspace_access,
    get_current_user,
)
from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.extraction.schemas import ReceiptExtraction
from katibay_api.verification.engine import verify_receipt
from katibay_api.verification.models import ActivityContext
from katibay_api.verification.rules import parse_date

router = APIRouter(tags=["Exceptions"])

# Fields a reviewer may correct while resolving an exception. Everything else —
# status, workspace_id, storage_path, sha256 — is pipeline state and must not be
# settable from a request body.
CORRECTABLE_RECEIPT_FIELDS = frozenset(
    {
        "merchant_name",
        "merchant_tin",
        "txn_date",
        "or_number",
        "subtotal",
        "vat_amount",
        "total_amount",
        "payment_method",
    }
)


class ExceptionResolutionRequest(BaseModel):
    """Payload for resolving or waiving an exception."""

    action: Literal["resolve", "waive"] = Field(
        default="resolve",
        description="'resolve' to apply correction/note, or 'waive' to accept as-is.",
    )
    correction: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Corrected receipt fields. Only reviewer-correctable fields are "
            f"accepted: {sorted(CORRECTABLE_RECEIPT_FIELDS)}."
        ),
    )

    reason: str | None = Field(
        default=None,
        description="Mandatory justification when waiving, or explanatory note.",
    )

    @field_validator("correction")
    @classmethod
    def reject_unknown_fields(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        if value is None:
            return value
        unknown = sorted(set(value) - CORRECTABLE_RECEIPT_FIELDS)
        if unknown:
            raise ValueError(
                f"Fields cannot be corrected through this endpoint: {unknown}."
            )
        return value


@router.get("/activities/{id}/exceptions")
async def get_activity_exceptions_endpoint(
    id: Annotated[uuid.UUID, Path(description="Activity UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
    kind: str | None = Query(default=None, description="Filter by exception kind"),
    severity: str | None = Query(
        default=None,
        description="Filter by severity ('blocking', 'warning', 'info')",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="Filter by status ('open', 'resolved', 'waived')",
    ),
) -> list[dict[str, Any]]:
    """Lists exceptions for an activity with optional filters."""
    activity = await db.get_activity(id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity {id} was not found.",
        )

    # Check workspace membership
    assert_workspace_access(user, activity["workspace_id"])

    exceptions = await db.get_activity_exceptions(
        activity_id=id,
        kind=kind,
        severity=severity,
        status=status_filter,
    )
    return list(exceptions)


@router.post("/exceptions/{id}/resolve")
async def resolve_exception_endpoint(
    id: Annotated[uuid.UUID, Path(description="Exception UUID")],
    request: ExceptionResolutionRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> dict[str, Any]:
    """Resolves or waives an exception, auditing before/after and re-verifying."""
    # 1. Validation: Waiver MUST have a non-empty reason
    if request.action == "waive" and (not request.reason or not request.reason.strip()):
        raise HTTPException(
            status_code=422,
            detail="A mandatory reason is required when waiving an exception.",
        )

    # 2. Fetch exception
    exc = await db.get_exception(id)
    if not exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exception {id} was not found.",
        )

    # 3. Identify parent workspace for auth
    workspace_id = None
    receipt = None
    if exc.get("receipt_id"):
        receipt = await db.get_receipt(exc["receipt_id"])
        if receipt:
            workspace_id = receipt["workspace_id"]
    elif exc.get("activity_id"):
        activity = await db.get_activity(exc["activity_id"])
        if activity:
            workspace_id = activity["workspace_id"]

    if workspace_id is None:
        # An exception whose owning workspace cannot be resolved cannot be
        # authorized against one either. Refuse rather than fall open.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Exception {id} is not linked to a resolvable receipt or "
                "activity, so its workspace cannot be authorized."
            ),
        )

    assert_workspace_access(user, workspace_id)

    before_state = {
        "id": str(exc["id"]),
        "status": exc["status"],
        "resolved_by": (str(exc["resolved_by"]) if exc.get("resolved_by") else None),
        "resolution_note": exc.get("resolution_note"),
    }

    target_status = "waived" if request.action == "waive" else "resolved"
    effective_note = request.reason or "Corrected values applied"

    # 4. Apply correction to receipt if applicable
    updated_receipt = None
    if receipt and request.correction:
        updated_receipt = await db.update_receipt(
            receipt_id=receipt["id"],
            **request.correction,
        )

    # 5. Update exception status in database
    resolved_exc = await db.update_exception(
        exception_id=id,
        status=target_status,
        resolved_by=user.id,
        resolution_note=effective_note,
    )

    after_state = {
        "id": str(id),
        "status": target_status,
        "resolved_by": str(user.id),
        "resolution_note": effective_note,
        "correction_applied": request.correction,
    }

    # 6. Write audit event
    await db.insert_audit_event(
        workspace_id=workspace_id,
        actor_id=user.id,
        entity_type="exceptions",
        entity_id=id,
        action=f"exception_{target_status}",
        before=before_state,
        after=after_state,
    )

    # 7. Re-run verification for receipt if attached
    reverification_report = None
    if receipt:
        current_receipt = updated_receipt or (await db.get_receipt(receipt["id"]))
        if current_receipt:
            extraction = ReceiptExtraction(
                merchant_name=current_receipt.get("merchant_name"),
                merchant_tin=current_receipt.get("merchant_tin"),
                txn_date=(
                    str(current_receipt.get("txn_date"))
                    if current_receipt.get("txn_date")
                    else None
                ),
                or_number=current_receipt.get("or_number"),
                subtotal=current_receipt.get("subtotal"),
                vat_amount=current_receipt.get("vat_amount"),
                total_amount=current_receipt.get("total_amount"),
                confidence=current_receipt.get("confidence", 1.0),
            )
            context = None
            if current_receipt.get("activity_id"):
                act = await db.get_activity(current_receipt["activity_id"])
                if act:
                    context = ActivityContext(
                        activity_id=act["id"],
                        start_date=(
                            parse_date(str(act["start_date"]))
                            if act.get("start_date")
                            else None
                        ),
                        end_date=(
                            parse_date(str(act["end_date"]))
                            if act.get("end_date")
                            else None
                        ),
                    )
            report = verify_receipt(extraction, context=context)
            reverification_report = {
                "passed": report.passed,
                "routing": report.routing,
                "remaining_exceptions": len(report.exceptions),
            }
            has_blocking = any(e.severity == "blocking" for e in report.exceptions)
            new_receipt_status = "exception" if has_blocking else "verified"
            await db.update_receipt(receipt_id=receipt["id"], status=new_receipt_status)

    return {
        "exception": resolved_exc,
        "reverification": reverification_report,
    }
