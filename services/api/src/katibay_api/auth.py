"""Supabase JWT authentication, workspace membership resolution, and role gating."""

import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status

from katibay_api.config import settings


@dataclass
class AuthenticatedUser:
    """Authenticated user context with resolved workspace memberships."""

    id: uuid.UUID
    email: str
    locale: str = "en"
    # Mapping of workspace_id -> role ('owner', 'treasurer', 'member', 'auditor')
    memberships: dict[uuid.UUID, str] = field(default_factory=dict)

    def role_in(self, workspace_id: uuid.UUID) -> str | None:
        """Returns the user's role in the given workspace, or None."""
        return self.memberships.get(workspace_id)


def decode_supabase_jwt(token: str, secret: str | None = None) -> dict:
    """Decodes and validates a Supabase JWT token."""
    key = secret or settings.jwt_secret
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
            options={
                "verify_signature": True,
                "verify_exp": True,
                # Supabase always sets aud; reject tokens that omit it rather
                # than silently accepting a token minted for another service.
                "require": ["exp", "sub"],
            },
        )
        return payload

    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(request: Request) -> AuthenticatedUser:
    """FastAPI dependency resolving current user from auth header or state."""
    # Check if middleware already resolved user

    if hasattr(request.state, "user") and request.state.user is not None:
        return request.state.user

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1]
    payload = decode_supabase_jwt(token)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain a valid subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(sub)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
        ) from exc

    email = payload.get("email", f"{sub}@example.com")
    locale = payload.get("user_metadata", {}).get("locale", "en")

    # In-memory / custom memberships hook from payload if provided
    memberships_dict: dict[uuid.UUID, str] = {}
    app_metadata = payload.get("app_metadata", {})
    raw_memberships = app_metadata.get("memberships", {})
    if isinstance(raw_memberships, dict):
        for ws_str, role_str in raw_memberships.items():
            try:
                memberships_dict[uuid.UUID(str(ws_str))] = str(role_str)
            except ValueError:
                continue

    auth_user = AuthenticatedUser(
        id=user_id,
        email=email,
        locale=locale,
        memberships=memberships_dict,
    )
    request.state.user = auth_user
    return auth_user


def assert_workspace_access(
    user: AuthenticatedUser,
    workspace_id: uuid.UUID,
    allowed_roles: Sequence[str] = ("owner", "treasurer", "member", "auditor"),
) -> str:
    """Raises 403 unless the user holds an allowed role in the workspace.

    Used by endpoints whose workspace is only known after loading a record, so
    the role cannot be resolved by ``require_role`` at dependency-wiring time.
    Returns the resolved role.
    """
    role = user.role_in(workspace_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: User is not a member of workspace {workspace_id}.",
        )
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied: Role '{role}' is not authorized. "
                f"Required roles: {list(allowed_roles)}."
            ),
        )
    return role


async def require_workspace_member(
    id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Path-parameter dependency gating any `/workspaces/{id}/...` route.

    Binds to the `id` path parameter, so the workspace being addressed is the
    one whose membership is checked.
    """
    assert_workspace_access(user, id)
    return user


def require_role(
    workspace_id: uuid.UUID,
    allowed_roles: Sequence[str] = ("owner", "treasurer", "member"),
) -> Callable[..., AuthenticatedUser]:
    """Dependency factory enforcing workspace membership and role-based access."""

    async def role_checker(
        user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    ) -> AuthenticatedUser:

        user_role = user.role_in(workspace_id)
        if user_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: User is not a member of workspace "
                    f"{workspace_id}."
                ),
            )

        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: Role '{user_role}' is not authorized. "
                    f"Required roles: {list(allowed_roles)}."
                ),
            )

        return user

    return role_checker
