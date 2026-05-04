"""
Shared async HTTP client for all backend → AI service calls.

Provides:
- Centralized base URL from settings
- Per-call timeout control (standard vs long-running)
- Automatic retry with exponential backoff on transient errors (5xx / network)
- Uniform error mapping to backend HTTPExceptions
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS_CODES = {500, 502, 503, 504}
_MAX_RETRIES = 2
_BACKOFF_FACTOR = 0.5  # seconds: 0.5, 1.0


async def _post_with_retry(
    path: str,
    payload: dict[str, Any],
    timeout: float,
) -> dict[str, Any]:
    """
    POST to the AI service with retry on transient failures.
    Raises HTTPException on permanent failures or bad payloads.
    """
    url = f"{settings.AI_SERVICE_URL}{path}"
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload)

            if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
                logger.warning("AI service 422 at %s — payload: %s", path, payload)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid request to AI service: {response.text}",
                )

            if response.status_code in _RETRYABLE_STATUS_CODES:
                logger.warning(
                    "AI service %s at %s (attempt %d/%d)",
                    response.status_code, path, attempt + 1, _MAX_RETRIES + 1,
                )
                last_exc = httpx.HTTPStatusError(
                    message=response.text,
                    request=response.request,
                    response=response,
                )
                if attempt < _MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(_BACKOFF_FACTOR * (2 ** attempt))
                continue

            response.raise_for_status()
            return response.json()

        except httpx.TimeoutException as exc:
            logger.warning("AI service timeout at %s (attempt %d/%d)", path, attempt + 1, _MAX_RETRIES + 1)
            last_exc = exc
            if attempt < _MAX_RETRIES:
                import asyncio
                await asyncio.sleep(_BACKOFF_FACTOR * (2 ** attempt))

        except httpx.ConnectError as exc:
            logger.error("AI service unreachable at %s", url)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is unavailable. Please try again later.",
            ) from exc

        except HTTPException:
            raise

        except Exception as exc:
            logger.exception("Unexpected error calling AI service at %s", path)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unexpected error communicating with AI service.",
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"AI service did not respond after {_MAX_RETRIES + 1} attempts.",
    ) from last_exc


async def ai_post(path: str, payload: dict[str, Any], long: bool = False) -> dict[str, Any]:
    """
    Public helper for all AI service POST calls.

    Args:
        path:    AI service route, e.g. '/heatmap/process'
        payload: JSON body dict
        long:    Use long timeout (quiz generation); default uses standard timeout
    """
    timeout = settings.AI_SERVICE_LONG_TIMEOUT if long else settings.AI_SERVICE_TIMEOUT
    return await _post_with_retry(path, payload, timeout)
