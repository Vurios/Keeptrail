"""HTTP middleware for request ID tracking, structured logging, and auth context."""

import time
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from katibay_api.auth import AuthenticatedUser, decode_supabase_jwt
from katibay_api.logging import logger, request_id_ctx


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware attaching request IDs and logging incoming/outgoing HTTP calls."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Resolve or generate X-Request-ID
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(req_id)

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            response.headers["X-Request-ID"] = req_id

            # Log request completion
            logger.info(
                "%s %s -> %d (%sms)",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "%s %s failed after %sms: %s",
                request.method,
                request.url.path,
                duration_ms,
                exc,
            )
            raise
        finally:
            request_id_ctx.reset(token)


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    """Middleware populating request.state.user from valid Supabase JWT if present."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request.state.user = None
        auth_header = request.headers.get("Authorization")

        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.split(" ", 1)[1]
            try:
                payload = decode_supabase_jwt(raw_token)
                sub = payload.get("sub")
                if sub:
                    user_id = uuid.UUID(sub)
                    email = payload.get("email", f"{sub}@example.com")
                    locale = payload.get("user_metadata", {}).get("locale", "en")
                    memberships_dict: dict[uuid.UUID, str] = {}
                    app_meta = payload.get("app_metadata", {})
                    raw_memberships = app_meta.get("memberships", {})
                    if isinstance(raw_memberships, dict):
                        for ws_str, role_str in raw_memberships.items():
                            try:
                                memberships_dict[uuid.UUID(str(ws_str))] = str(role_str)
                            except ValueError:
                                continue

                    request.state.user = AuthenticatedUser(
                        id=user_id,
                        email=email,
                        locale=locale,
                        memberships=memberships_dict,
                    )
            except Exception:
                # Token errors will be handled by auth dependencies when required
                pass

        return await call_next(request)
