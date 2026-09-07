"""Katibay API main application entrypoint."""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from katibay_api import __version__
from katibay_api.activities.router import router as activities_router
from katibay_api.config import check_production_secrets, settings
from katibay_api.errors import register_error_handlers
from katibay_api.exceptions.router import router as exceptions_router
from katibay_api.logging import setup_logging
from katibay_api.metrics import router as metrics_router
from katibay_api.middleware import (
    RequestLoggingMiddleware,
    SupabaseAuthMiddleware,
)
from katibay_api.passports.router import router as passports_router
from katibay_api.receipts.router import router as receipts_router
from katibay_api.reconciliation.router import router as reconciliation_router

# Initialize Sentry if DSN is configured in environment
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            environment=os.getenv("ENVIRONMENT", "production"),
            release=f"katibay-api@{__version__}",
        )
    except ImportError:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan context manager for startup and shutdown."""
    setup_logging()

    # Refuse to serve production traffic with development credentials. Failing
    # at boot is far cheaper than discovering forged tokens in the audit log.
    problems = check_production_secrets()
    if problems:
        raise RuntimeError(
            "Refusing to start in production with insecure configuration:\n  - "
            + "\n  - ".join(problems)
        )

    yield


app = FastAPI(
    title="Katibay API",
    description=(
        "Katibay receipt verification pipeline, liquidation packets, "
        "and Purchase Passports"
    ),
    version=__version__,
    lifespan=lifespan,
)

# Register Global Error Handlers (RFC-7807)
register_error_handlers(app)

# Register Middlewares (Order: Logging outermost, then Auth, then CORS)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SupabaseAuthMiddleware)
# An explicit origin allowlist. A wildcard here would combine with
# allow_credentials to echo back any requesting origin, which is the same as
# having no cross-origin protection at all.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "version": __version__}


# Include Routers
app.include_router(receipts_router)
app.include_router(reconciliation_router)
app.include_router(exceptions_router)
app.include_router(activities_router)
app.include_router(passports_router)
app.include_router(metrics_router)
