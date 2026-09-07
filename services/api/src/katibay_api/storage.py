"""Storage client interface and Supabase Storage implementation."""

import time
from typing import Protocol

import httpx

from katibay_api.config import settings


class StorageClientProtocol(Protocol):
    """Protocol for storage operations."""

    async def upload_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str,
    ) -> str:
        """Uploads a file to storage and returns the storage path/key."""
        ...

    async def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 60,
    ) -> str:
        """Generates a temporary signed URL with strict expiration (default 60s)."""
        ...


class SupabaseStorageClient:
    """Async client interacting with Supabase Storage REST API."""

    def __init__(
        self,
        supabase_url: str = settings.supabase_url,
        service_key: str = settings.supabase_service_key,
    ) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_key = service_key

    async def upload_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str,
    ) -> str:
        """Uploads binary data to a private Supabase Storage bucket."""
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{path}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
            "Content-Type": content_type,
            "x-upsert": "false",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, content=content)
            if response.status_code not in (200, 201):
                response.raise_for_status()

        return path

    async def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 60,
    ) -> str:
        """Generates a signed URL from Supabase Storage expiring in `expires_in` s."""

        url = f"{self.supabase_url}/storage/v1/object/sign/{bucket}/{path}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
            "Content-Type": "application/json",
        }
        payload = {"expiresIn": expires_in}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                data = response.json()
                signed_path = data.get("signedURL", "")
                if signed_path.startswith("http"):
                    return signed_path
                return f"{self.supabase_url}/storage/v1{signed_path}"
            response.raise_for_status()

        return f"{self.supabase_url}/storage/v1/object/authenticated/{bucket}/{path}"


class InMemoryStorageClient:
    """In-memory storage client for testing."""

    def __init__(self) -> None:
        self.files: dict[str, tuple[bytes, str]] = {}

    async def upload_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str,
    ) -> str:
        key = f"{bucket}/{path}"
        self.files[key] = (content, content_type)
        return path

    async def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 60,
    ) -> str:
        expiry_timestamp = int(time.time()) + expires_in
        return (
            f"https://supabase.mock/storage/v1/object/sign/{bucket}/{path}"
            f"?token=mock-signed-{expires_in}s&expires={expiry_timestamp}"
        )


_storage_client: StorageClientProtocol = SupabaseStorageClient()


def get_storage_client() -> StorageClientProtocol:
    return _storage_client


def set_storage_client(client: StorageClientProtocol) -> None:
    global _storage_client
    _storage_client = client
