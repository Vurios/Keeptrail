"""Tests for Katibay Purchase Passports, Claims, and Expiry Notifications."""

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from katibay_api.db import InMemoryRepository, set_db_repository
from katibay_api.main import app
from katibay_api.passports.scheduler import check_passport_expiries
from tests.helpers import auth_headers


@pytest.fixture
def test_repo() -> InMemoryRepository:
    repo = InMemoryRepository()
    set_db_repository(repo)
    return repo


@pytest.fixture
def client(test_repo: InMemoryRepository) -> TestClient:
    return TestClient(app)


def test_promote_receipt_to_passport(
    client: TestClient, test_repo: InMemoryRepository
) -> None:
    workspace_id = uuid.uuid4()
    receipt_id = uuid.uuid4()

    # Prepopulate receipt in repo
    receipt_record = type(
        "ReceiptRecord",
        (),
        {
            "id": receipt_id,
            "workspace_id": workspace_id,
            "merchant_name": "Silicon Valley Computer Store",
            "storage_path": "receipts/rec-macbook.jpg",
            "or_number": "OR-2026-9912",
            "total_amount": 7500000,
        },
    )()
    test_repo.receipts.append(receipt_record)

    payload = {
        "item_name": "MacBook Pro M3 14-inch",
        "brand": "Apple",
        "model": "A2992",
        "serial_number": "C02XYZ123456",
        "purchase_date": "2026-01-15",
        "warranty_months": 24,
        "coverage_notes": (
            "Official AppleCare Protection Plan covering battery and hardware defects."
        ),
    }

    headers = auth_headers(workspace_id, role="treasurer")

    response = client.post(
        f"/receipts/{receipt_id}/promote",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["item_name"] == "MacBook Pro M3 14-inch"
    assert data["brand"] == "Apple"
    assert data["warranty_months"] == 24
    assert data["warranty_expires_at"] == "2028-01-15"
    assert data["status"] == "active"

    # Duplicate promotion should return 409 Conflict
    dup_res = client.post(
        f"/receipts/{receipt_id}/promote",
        json=payload,
        headers=headers,
    )
    assert dup_res.status_code == 409


def test_file_passport_claim_and_generate_packet(
    client: TestClient, test_repo: InMemoryRepository
) -> None:
    workspace_id = uuid.uuid4()
    receipt_id = uuid.uuid4()
    passport_id = uuid.uuid4()

    # Prepopulate receipt and passport
    receipt_record = type(
        "ReceiptRecord",
        (),
        {
            "id": receipt_id,
            "workspace_id": workspace_id,
            "merchant_name": "Sony Centre Megamall",
            "storage_path": "receipts/sony-cam.jpg",
            "or_number": "SI-889912",
            "total_amount": 12000000,
        },
    )()
    test_repo.receipts.append(receipt_record)

    passport_record = {
        "id": passport_id,
        "workspace_id": workspace_id,
        "receipt_id": receipt_id,
        "item_name": "Sony FX3 Cinema Camera",
        "brand": "Sony",
        "model": "ILME-FX3",
        "serial_number": "SN-8821099",
        "purchase_date": date(2026, 3, 1),
        "warranty_months": 12,
        "warranty_expires_at": date(2027, 3, 1),
        "coverage_notes": "Official Sony Philippines 1-year service warranty.",
        "status": "active",
        "created_at": None,
        "updated_at": None,
    }
    test_repo.passports.append(passport_record)

    headers = auth_headers(workspace_id, role="treasurer")

    claim_payload = {
        "fault_description": (
            "Main sensor shutter unit intermittently locks up "
            "during 4K 60fps recording."
        ),
    }

    response = client.post(
        f"/passports/{passport_id}/claim",
        json=claim_payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert "claim" in data
    assert data["claim"]["fault_description"] == claim_payload["fault_description"]
    assert "packet_sha256" in data
    assert len(data["packet_sha256"]) == 64
    assert "pdf_base64" in data
    assert len(data["pdf_base64"]) > 100


@pytest.mark.asyncio
async def test_passport_expiry_notifications_thresholds(
    test_repo: InMemoryRepository,
) -> None:
    today = date(2026, 9, 1)
    workspace_id = uuid.uuid4()

    # Setup 4 passports with different expiration horizons:
    # 1. Active: expires in 120 days
    # 2. 60-day notice: expires in 55 days
    # 3. 30-day warning: expires in 25 days
    # 4. 7-day critical: expires in 3 days
    # 5. Expired: expired 5 days ago

    p_active = {
        "id": uuid.uuid4(),
        "workspace_id": workspace_id,
        "receipt_id": uuid.uuid4(),
        "item_name": "Projector Epson",
        "warranty_expires_at": today + timedelta(days=120),
        "status": "active",
    }
    p_60 = {
        "id": uuid.uuid4(),
        "workspace_id": workspace_id,
        "receipt_id": uuid.uuid4(),
        "item_name": "Wireless Mic Set",
        "warranty_expires_at": today + timedelta(days=55),
        "status": "active",
    }
    p_30 = {
        "id": uuid.uuid4(),
        "workspace_id": workspace_id,
        "receipt_id": uuid.uuid4(),
        "item_name": "Audio Mixer Console",
        "warranty_expires_at": today + timedelta(days=25),
        "status": "active",
    }
    p_7 = {
        "id": uuid.uuid4(),
        "workspace_id": workspace_id,
        "receipt_id": uuid.uuid4(),
        "item_name": "Dell UltraSharp Monitor",
        "warranty_expires_at": today + timedelta(days=3),
        "status": "active",
    }
    p_exp = {
        "id": uuid.uuid4(),
        "workspace_id": workspace_id,
        "receipt_id": uuid.uuid4(),
        "item_name": "Laser Printer",
        "warranty_expires_at": today - timedelta(days=5),
        "status": "active",
    }

    test_repo.passports.extend([p_active, p_60, p_30, p_7, p_exp])

    notifications = await check_passport_expiries(
        reference_date=today, db_repo=test_repo
    )

    assert len(notifications) == 4
    tiers = {n["item_name"]: n["tier"] for n in notifications}
    assert tiers["Wireless Mic Set"] == "notice_60d"
    assert tiers["Audio Mixer Console"] == "warning_30d"
    assert tiers["Dell UltraSharp Monitor"] == "critical_7d"
    assert tiers["Laser Printer"] == "expired"

    # Verify status updates in repo
    assert p_60["status"] == "expiring"
    assert p_30["status"] == "expiring"
    assert p_7["status"] == "expiring"
    assert p_exp["status"] == "expired"
    assert p_active["status"] == "active"
