"""FastAPI router for Passport promotion, claims, and warranty management."""

import base64
import logging
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from katibay_api.auth import (
    AuthenticatedUser,
    assert_workspace_access,
    get_current_user,
)
from katibay_api.db import DatabaseRepository, get_db_repository
from katibay_api.passports.scheduler import check_passport_expiries
from katibay_api.reports.claim_packet import generate_claim_packet_pdf

logger = logging.getLogger("katibay_api.passports.router")

router = APIRouter(tags=["Passports"])


class PromoteReceiptRequest(BaseModel):
    item_name: str = Field(..., min_length=1)
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    purchase_date: date
    warranty_months: int = Field(..., gt=0)
    coverage_notes: str | None = None


class FileClaimRequest(BaseModel):
    fault_description: str = Field(..., min_length=5)


@router.post("/receipts/{id}/promote", status_code=status.HTTP_201_CREATED)
async def promote_receipt_to_passport(
    id: uuid.UUID,
    payload: PromoteReceiptRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
):
    """Promotes a verified receipt into an asset passport with warranty tracking."""
    receipt = await db_repo.get_receipt(id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt {id} not found.",
        )

    assert_workspace_access(
        current_user, receipt["workspace_id"], allowed_roles=("owner", "treasurer")
    )

    # Check if a passport already exists for this receipt
    if hasattr(db_repo, "passports"):
        existing = next(
            (p for p in db_repo.passports if p.get("receipt_id") == id), None
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A passport already exists for receipt {id}.",
            )

    passport = await db_repo.insert_passport(
        workspace_id=receipt["workspace_id"],
        receipt_id=id,
        item_name=payload.item_name,
        brand=payload.brand,
        model=payload.model,
        serial_number=payload.serial_number,
        purchase_date=payload.purchase_date,
        warranty_months=payload.warranty_months,
        coverage_notes=payload.coverage_notes,
    )

    # Record audit event
    await db_repo.insert_audit_event(
        workspace_id=receipt["workspace_id"],
        actor_id=current_user.id,
        entity_type="passport",
        entity_id=passport["id"],
        action="passport.promoted",
        before=None,
        after={
            "item_name": payload.item_name,
            "warranty_months": payload.warranty_months,
            "warranty_expires_at": str(passport.get("warranty_expires_at")),
        },
    )

    return passport


@router.get("/workspaces/{id}/passports")
async def list_workspace_passports(
    id: uuid.UUID,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
):
    """Lists all asset passports owned within a workspace."""
    assert_workspace_access(current_user, id)
    return await db_repo.get_workspace_passports(id)


@router.get("/passports/{id}")
async def get_passport_details(
    id: uuid.UUID,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
):
    """Returns detailed information for a specific passport."""

    passport = await db_repo.get_passport(id)
    if not passport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passport {id} not found.",
        )

    assert_workspace_access(current_user, passport["workspace_id"])

    claims = await db_repo.get_passport_claims(id)
    return {
        **passport,
        "claims": claims,
    }


@router.post("/passports/{id}/claim", status_code=status.HTTP_201_CREATED)
async def file_passport_warranty_claim(
    id: uuid.UUID,
    payload: FileClaimRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
):
    """Files a warranty claim and generates a cryptographic claim-packet PDF."""
    passport = await db_repo.get_passport(id)
    if not passport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passport {id} not found.",
        )

    assert_workspace_access(
        current_user, passport["workspace_id"], allowed_roles=("owner", "treasurer")
    )

    # Temporary claim object for PDF generation
    temp_claim = {
        "id": uuid.uuid4(),
        "passport_id": id,
        "fault_description": payload.fault_description,
        "opened_at": date.today(),
    }

    # Render claim packet PDF
    pdf_bytes, sha256_hash = generate_claim_packet_pdf(passport, temp_claim)
    packet_path = f"claims/{id}/{temp_claim['id']}.pdf"

    # Insert into database
    claim_record = await db_repo.insert_claim(
        passport_id=id,
        fault_description=payload.fault_description,
        packet_path=packet_path,
    )

    # Record audit event
    await db_repo.insert_audit_event(
        workspace_id=passport["workspace_id"],
        actor_id=current_user.id,
        entity_type="claim",
        entity_id=claim_record["id"],
        action="passport.claim_filed",
        before=None,
        after={
            "passport_id": str(id),
            "fault_description": payload.fault_description,
            "packet_sha256": sha256_hash,
            "packet_path": packet_path,
        },
    )

    return {
        "claim": claim_record,
        "packet_sha256": sha256_hash,
        "packet_path": packet_path,
        "pdf_base64": base64.b64encode(pdf_bytes).decode("utf-8"),
    }


@router.post("/passports/cron/check-expiries")
async def run_expiry_notifications_job(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
):
    """Triggers the scheduled warranty expiry notification job."""
    notifications = await check_passport_expiries(db_repo=db_repo)
    return {
        "notifications_sent": len(notifications),
        "notifications": notifications,
    }
