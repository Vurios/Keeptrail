"""FastAPI router for activity management, closure lifecycle, and audit trail."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, status

from katibay_api.auth import AuthenticatedUser, get_current_user
from katibay_api.db import DatabaseRepository, get_db_repository

router = APIRouter(prefix="/activities", tags=["Activities"])


@router.get("/{id}/audit")
async def get_activity_audit_trail(
    id: Annotated[uuid.UUID, Path(description="Activity UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> list[dict[str, Any]]:
    """Returns chronological audit events for an activity with diff states."""

    activity = await db.get_activity(id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity {id} was not found.",
        )
    return list(await db.get_activity_audit_events(id))


@router.post("/{id}/close")
async def close_activity_endpoint(
    id: Annotated[uuid.UUID, Path(description="Activity UUID")],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[DatabaseRepository, Depends(get_db_repository)],
) -> dict[str, Any]:
    """Closes an activity if and only if all blocking exceptions are resolved/waived.

    Requires 'owner' or 'treasurer' role.
    """
    activity = await db.get_activity(id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity {id} was not found.",
        )

    workspace_id = activity["workspace_id"]
    user_role = user.role_in(workspace_id)
    if user_role not in ("owner", "treasurer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Access denied: Closing an activity requires 'owner' or "
                "'treasurer' role."
            ),
        )

    # Check for open blocking exceptions
    blocking_exceptions = await db.get_activity_exceptions(
        activity_id=id,
        severity="blocking",
        status="open",
    )
    if blocking_exceptions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot close activity: {len(blocking_exceptions)} blocking "
                f"exceptions remain open. Resolve or waive them first."
            ),
        )

    before_state = {"status": activity["status"]}
    updated_activity = await db.update_activity_status(
        activity_id=id,
        status="closed",
    )
    after_state = {"status": "closed"}

    await db.insert_audit_event(
        workspace_id=workspace_id,
        actor_id=user.id,
        entity_type="activities",
        entity_id=id,
        action="activity_closed",
        before=before_state,
        after=after_state,
    )

    return updated_activity
