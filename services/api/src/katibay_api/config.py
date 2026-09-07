"""Katibay API configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_key: str = "test-service-key"
    supabase_anon_key: str = "test-anon-key"
    supabase_db_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    supabase_storage_bucket_receipts: str = "receipts"

    # Gemini (Rule 6: Gemini model ID lives in one config constant)
    gemini_api_key: str = ""
    gemini_model_id: str = "gemini-2.0-flash"

    # Upload & Preprocessing Limits
    max_upload_size_bytes: int = 10 * 1024 * 1024  # 10 MB
    preprocessor_long_edge_px: int = 1600
    preprocessor_jpeg_quality: int = 85
    phash_hamming_distance_threshold: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
