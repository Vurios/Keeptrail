"""Rate limiting utility for Katibay API upload endpoints."""

import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Sliding window in-memory rate limiter per client IP or key."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds

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


async def check_upload_rate_limit(request: Request) -> None:
    """FastAPI dependency to enforce rate limit on upload endpoints."""
    # Identify client by forward header, IP, or authorization header
    client_ip = (
        request.headers.get("x-forwarded-for")
        or request.headers.get("authorization", "")
        or (request.client.host if request.client else "unknown")
    )
    upload_rate_limiter.check(client_ip)


RateLimitDependency = Annotated[None, Depends(check_upload_rate_limit)]
