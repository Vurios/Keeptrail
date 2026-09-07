"""Katibay API configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Runtime
    environment: str = "development"

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_key: str = "test-service-key"
    supabase_anon_key: str = "test-anon-key"
    supabase_db_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    supabase_storage_bucket_receipts: str = "receipts"

    # Secret used to verify Supabase-issued access tokens (HS256). This is the
    # project's JWT secret, which is NOT the same value as the service role key.
    # Empty means "fall back to supabase_service_key", which is only tolerated
    # outside production; see require_production_secrets().
    supabase_jwt_secret: str = ""
    supabase_jwt_audience: str = "authenticated"

    # Comma-separated list of browser origins allowed to call the API with
    # credentials. A wildcard is rejected in production.
    cors_allowed_origins: str = "http://localhost:3000"

    # Trust X-Forwarded-For for client identification (rate limiting). Only
    # enable when the API sits behind a proxy that overwrites the header.
    trust_forwarded_for: bool = False

    # Gemini (Rule 6: Gemini model ID lives in one config constant)
    gemini_api_key: str = ""
    gemini_model_id: str = "gemini-2.0-flash"

    # Upload & Preprocessing Limits
    max_upload_size_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_files_per_upload: int = 20
    preprocessor_long_edge_px: int = 1600
    preprocessor_jpeg_quality: int = 85
    phash_hamming_distance_threshold: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in ("production", "prod")

    @property
    def jwt_secret(self) -> str:
        """The key used to verify access tokens."""
        return self.supabase_jwt_secret or self.supabase_service_key

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


settings = Settings()

# Values that ship as convenient development defaults but must never reach a
# deployed environment, because anyone who has read this repository knows them.
INSECURE_DEFAULTS = {
    "supabase_service_key": "test-service-key",
    "supabase_anon_key": "test-anon-key",
}


def check_production_secrets(current: Settings | None = None) -> list[str]:
    """Returns human-readable reasons the settings are unsafe for production."""
    cfg = current or settings
    problems: list[str] = []

    if not cfg.is_production:
        return problems

    if not cfg.supabase_jwt_secret:
        problems.append(
            "SUPABASE_JWT_SECRET is unset; token verification would fall back to "
            "the service role key."
        )
    elif len(cfg.supabase_jwt_secret) < 32:
        problems.append("SUPABASE_JWT_SECRET is shorter than 32 characters.")

    for field, insecure_value in INSECURE_DEFAULTS.items():
        if getattr(cfg, field) == insecure_value:
            problems.append(f"{field.upper()} still holds its development default.")

    if "*" in cfg.cors_origins:
        problems.append(
            "CORS_ALLOWED_ORIGINS contains '*', which cannot be combined with "
            "credentialed requests."
        )

    return problems
