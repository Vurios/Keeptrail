"""Gemini multimodal receipt extraction engine."""

import base64
import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from katibay_api.config import settings
from katibay_api.extraction.prompts import EXTRACTION_SYSTEM_PROMPT
from katibay_api.extraction.schemas import ReceiptExtraction

logger = logging.getLogger("katibay_api.extraction")


@dataclass
class ExtractionResult:
    """Outcome of the Gemini extraction process."""

    extraction: ReceiptExtraction | None
    raw_response: dict[str, Any] | None
    raw_text: str
    model_version: str
    is_exception: bool = False
    exception_kind: str | None = None
    exception_reason: str | None = None


class GeminiClientProtocol(Protocol):
    """Protocol for Gemini API interaction."""

    async def generate_structured_content(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        model_id: str,
        api_key: str,
    ) -> str: ...


class HttpGeminiClient:
    """Production client calling Google Gemini multimodal REST API."""

    def __init__(self, timeout_sec: float = 45.0) -> None:
        self.timeout = timeout_sec

    async def generate_structured_content(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        model_id: str,
        api_key: str,
    ) -> str:
        # The key travels in a header, not the query string: URLs end up in
        # proxy logs, error traces and httpx's own request repr.
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_id}:generateContent"
        )
        headers = {"x-goog-api-key": api_key}
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        json_schema = ReceiptExtraction.model_json_schema()

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_image,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "response_schema": json_schema,
                "temperature": 0.0,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code >= 500 or response.status_code == 429:
                # Transient error
                response.raise_for_status()

            if response.status_code != 200:
                raise ValueError(
                    f"Gemini API returned error {response.status_code}: {response.text}"
                )

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("Gemini API returned no candidates.")

            content_parts = candidates[0].get("content", {}).get("parts", [])
            if not content_parts or "text" not in content_parts[0]:
                raise ValueError("Gemini API response did not contain text content.")

            return content_parts[0]["text"]


class MockGeminiClient:
    """Mock client returning pre-recorded fixture responses."""

    def __init__(self, canned_response_text: str | None = None) -> None:
        self.canned_response_text = canned_response_text
        self.call_count = 0
        self.transient_fail_count = 0

    async def generate_structured_content(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        model_id: str,
        api_key: str,
    ) -> str:
        self.call_count += 1
        if self.transient_fail_count > 0:
            self.transient_fail_count -= 1
            raise httpx.ConnectTimeout("Transient connection timeout")

        if self.canned_response_text is None:
            raise ValueError("No canned response configured for MockGeminiClient.")
        return self.canned_response_text


_default_gemini_client: GeminiClientProtocol = HttpGeminiClient()


def get_gemini_client() -> GeminiClientProtocol:
    return _default_gemini_client


def set_gemini_client(client: GeminiClientProtocol) -> None:
    global _default_gemini_client
    _default_gemini_client = client


async def extract_receipt_from_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    client: GeminiClientProtocol | None = None,
    model_id: str = settings.gemini_model_id,
    api_key: str = settings.gemini_api_key,
) -> ExtractionResult:
    """Extracts structured receipt data using Gemini with transient retry & refusal."""

    gemini_client = client or get_gemini_client()
    raw_text = ""

    # Attempt extraction with 1 retry on transient network errors
    for attempt in (1, 2):
        try:
            raw_text = await gemini_client.generate_structured_content(
                image_bytes=image_bytes,
                mime_type=mime_type,
                prompt=EXTRACTION_SYSTEM_PROMPT,
                model_id=model_id,
                api_key=api_key,
            )
            break
        except (httpx.HTTPError, TimeoutError, ConnectionError) as transient_exc:
            if attempt == 1:
                logger.warning(
                    "Transient error calling Gemini (attempt 1): %s. Retrying...",
                    transient_exc,
                )
                continue
            # After retry, return low_confidence exception
            logger.error("Failed to extract receipt after retry: %s", transient_exc)
            return ExtractionResult(
                extraction=None,
                raw_response=None,
                raw_text=str(transient_exc),
                model_version=model_id,
                is_exception=True,
                exception_kind="low_confidence",
                exception_reason=f"Transient service failure: {str(transient_exc)}",
            )
        except Exception as exc:
            # Non-transient error (refusal, bad payload, etc.)
            logger.error("Non-transient error during extraction: %s", exc)
            return ExtractionResult(
                extraction=None,
                raw_response=None,
                raw_text=str(exc),
                model_version=model_id,
                is_exception=True,
                exception_kind="low_confidence",
                exception_reason=f"Model refusal or API error: {str(exc)}",
            )

    # Parse JSON output and validate against ReceiptExtraction schema
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as json_err:
        logger.error("Model returned malformed JSON: %s", raw_text)
        return ExtractionResult(
            extraction=None,
            raw_response=None,
            raw_text=raw_text,
            model_version=model_id,
            is_exception=True,
            exception_kind="low_confidence",
            exception_reason=f"Malformed JSON from model: {str(json_err)}",
        )

    try:
        extraction_model = ReceiptExtraction.model_validate(data)
        return ExtractionResult(
            extraction=extraction_model,
            raw_response=data,
            raw_text=raw_text,
            model_version=model_id,
            is_exception=False,
        )
    except Exception as val_err:
        logger.error("Schema validation failed on model output: %s", val_err)
        return ExtractionResult(
            extraction=None,
            raw_response=data,
            raw_text=raw_text,
            model_version=model_id,
            is_exception=True,
            exception_kind="low_confidence",
            exception_reason=f"Schema validation failure: {str(val_err)}",
        )
