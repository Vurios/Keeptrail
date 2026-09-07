"""Acceptance tests for Prompt 3: Auth, RBAC, and RFC-7807 problem details."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient

from katibay_api.auth import AuthenticatedUser, get_current_user, require_role
from katibay_api.config import settings
from katibay_api.main import app

DEMO_WS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

auth_test_router = APIRouter(prefix="/test-auth", tags=["TestAuth"])


@auth_test_router.get("/protected")
async def protected_endpoint(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> dict:
    return {"user_id": str(user.id), "email": user.email}


@auth_test_router.get("/workspace/{workspace_id}/treasurer-only")
async def workspace_treasurer_endpoint(
    workspace_id: uuid.UUID,
    user: Annotated[
        AuthenticatedUser,
        Depends(require_role(DEMO_WS_ID, ["owner", "treasurer"])),
    ],
) -> dict:
    return {
        "status": "authorized",
        "role": user.role_in(DEMO_WS_ID),
    }


app.include_router(auth_test_router)
client = TestClient(app)

SECRET_KEY = "test-service-key-with-at-least-32-bytes-length"
settings.supabase_service_key = SECRET_KEY


def generate_jwt(
    user_id: uuid.UUID,
    email: str = "test@example.com",
    memberships: dict[str, str] | None = None,
    expires_in_sec: int = 3600,
) -> str:
    """Generates a test Supabase-like JWT."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_sec)).timestamp()),
        "app_metadata": {"memberships": memberships or {}},
        "user_metadata": {"locale": "en"},
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def test_missing_token_returns_401_rfc7807():
    """Requests without token receive 401 with application/problem+json."""
    response = client.get("/test-auth/protected")
    assert response.status_code == 401
    assert "application/problem+json" in response.headers["content-type"]
    body = response.json()
    assert body["status"] == 401
    assert body["title"] == "Unauthorized"
    assert "Authentication credentials were not provided" in body["detail"]
    assert "request_id" in body


def test_expired_token_returns_401_rfc7807():
    """Requests with expired token receive 401."""
    user_id = uuid.uuid4()
    expired_token = generate_jwt(user_id=user_id, expires_in_sec=-60)

    response = client.get(
        "/test-auth/protected",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "application/problem+json" in response.headers["content-type"]
    body = response.json()
    assert body["status"] == 401
    assert "Token has expired" in body["detail"]


def test_valid_token_authenticates_user():
    """Requests with valid token succeed."""
    user_id = uuid.uuid4()
    valid_token = generate_jwt(user_id=user_id, email="alice@katibay.ph")

    response = client.get(
        "/test-auth/protected",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(user_id)
    assert data["email"] == "alice@katibay.ph"


def test_wrong_workspace_access_denied_403_rfc7807():
    """User not in the required workspace receives 403 Forbidden."""
    user_id = uuid.uuid4()
    other_ws_id = str(uuid.uuid4())
    # User belongs only to other_ws_id, not to DEMO_WS_ID
    token = generate_jwt(
        user_id=user_id,
        memberships={other_ws_id: "treasurer"},
    )

    response = client.get(
        f"/test-auth/workspace/{DEMO_WS_ID}/treasurer-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert "application/problem+json" in response.headers["content-type"]
    body = response.json()
    assert body["status"] == 403
    assert "User is not a member of workspace" in body["detail"]


def test_insufficient_role_access_denied_403_rfc7807():
    """User who is only a 'member' cannot access 'treasurer/owner' endpoints."""
    user_id = uuid.uuid4()
    target_workspace = str(DEMO_WS_ID)
    token = generate_jwt(
        user_id=user_id,
        memberships={target_workspace: "member"},
    )

    response = client.get(
        f"/test-auth/workspace/{target_workspace}/treasurer-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    body = response.json()
    assert "not authorized" in body["detail"]


def test_authorized_role_succeeds():
    """Owner or Treasurer can access the protected workspace endpoint."""
    user_id = uuid.uuid4()
    target_workspace = str(DEMO_WS_ID)
    token = generate_jwt(
        user_id=user_id,
        memberships={target_workspace: "treasurer"},
    )

    response = client.get(
        f"/test-auth/workspace/{target_workspace}/treasurer-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "authorized"
    assert response.json()["role"] == "treasurer"


def test_request_id_tracking_header():
    """Responses contain X-Request-ID header matching passed or generated ID."""
    custom_req_id = "test-req-12345"
    response = client.get(
        "/health",
        headers={"X-Request-ID": custom_req_id},
    )
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_req_id
