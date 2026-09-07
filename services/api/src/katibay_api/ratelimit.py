"""Rate limiting utility for Katibay API upload endpoints."""

import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from katibay_api.config import settings


class SlidingWindowRateLimiter:
    """Sliding window in-memory rate limiter per client IP or key."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds

        # Drop keys whose window has fully expired, so an attacker cycling
        # identifiers cannot grow this dict without bound.
        for stale_key in [
            k
            for k, stamps in self._history.items()
            if not stamps or stamps[-1] <= cutoff
        ]:
            del self._history[stale_key]

        # Prune older timestamps
        self._history[key] = [t for t in self._history[key] if t > cutoff]

        if len(self._history[key]) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - self._history[key][0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Rate limit exceeded: maximum {self.max_requests} uploads "
                    f"per {self.window_seconds}s."
                ),
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self._history[key].append(now)

    def reset(self) -> None:
        self._history.clear()


upload_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


def resolve_rate_limit_key(request: Request) -> str:
    """Identifies the caller for rate limiting.

    Prefers the authenticated user, since that identity cannot be rotated by
    sending a different header. X-Forwarded-For is only consulted when the
    deployment declares that it sits behind a proxy which overwrites it;
    otherwise a client could bypass the limit by varying that header per
    request.
    """
    user = getattr(request.state, "user", None)
    if user is not None:
        return f"user:{user.id}"

    if settings.trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Left-most entry is the originating client.
            return f"ip:{forwarded.split(',')[0].strip()}"

    return f"ip:{request.client.host if request.client else 'unknown'}"


async def check_upload_rate_limit(request: Request) -> None:
    """FastAPI dependency to enforce rate limit on upload endpoints."""
    upload_rate_limiter.check(resolve_rate_limit_key(request))


RateLimitDependency = Annotated[None, Depends(check_upload_rate_limit)]
