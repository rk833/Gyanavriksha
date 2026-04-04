"""Redis-backed rate-limiting middleware for the Gyanavriksha API.

Strategy: fixed-window counter keyed on ``{client_ip}:{time_window}:{method}:{route}``.
Each window lasts ``RATE_LIMIT_PERIOD`` seconds. Clients that exceed
``RATE_LIMIT_CALLS`` requests within a window receive HTTP 429.

Remaining-capacity headers (``X-RateLimit-Limit``, ``X-RateLimit-Remaining``,
``X-RateLimit-Reset``) are appended to every successful response so the
frontend can surface quota information without issuing a separate request.

The middleware fails open: if the Redis connection is unavailable the request
is allowed through so an outage in the cache layer does not take down the API.

Doc/schema routes (``/docs``, ``/redoc``, ``/openapi.json``) are exempt.
Rate limiting is also skipped entirely when ``ENVIRONMENT == "testing"``.
"""
import time

from redis.asyncio import Redis
from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.core.config import settings

_EXEMPT_PREFIXES = ("/api/docs", "/api/redoc", "/openapi.json")

redis: Redis = Redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


def _is_exempt(path: str) -> bool:
    """Return True when the request path should bypass rate limiting."""
    return any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES)


def _build_key(client: str, window: int, method: str, route: str) -> str:
    """Build the Redis counter key for this client/window/endpoint combination."""
    return f"rate:{client}:{window}:{method}:{route}"


def _rate_limit_headers(calls: int, count: int, reset_ts: int) -> dict:
    """Return the standard rate-limit response headers."""
    return {
        "X-RateLimit-Limit": str(calls),
        "X-RateLimit-Remaining": str(max(calls - count, 0)),
        "X-RateLimit-Reset": str(reset_ts),
    }


async def _get_request_count(key: str, period: int) -> int:
    """Increment the Redis counter for the key and set TTL on first write.

    Returns the updated counter value, or 0 when Redis is unreachable so the
    middleware can fail open.
    """
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, period)
        return count
    except Exception:
        return 0


async def rate_limit_middleware(request: Request, call_next):
    """ASGI middleware that enforces per-client, per-endpoint rate limits via Redis.

    Limits the number of requests a single IP may make to a specific
    method + route combination within the configured time window. This
    per-route granularity prevents a high-volume page (e.g. dashboard poll)
    from consuming the quota of sensitive endpoints (e.g. login).
    """
    if settings.ENVIRONMENT == "testing" or _is_exempt(request.url.path):
        return await call_next(request)
    calls = settings.RATE_LIMIT_CALLS
    period = settings.RATE_LIMIT_PERIOD
    client = request.client.host
    method = request.method
    route = request.url.path
    window = int(time.time() // period)
    reset_ts = (window + 1) * period
    key = _build_key(client, window, method, route)
    count = await _get_request_count(key, period)
    if count > calls:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"Rate limit exceeded for {method} {route}. "
                          f"Retry after {reset_ts - int(time.time())} seconds.",
                "retry_after": reset_ts - int(time.time()),
            },
        )
    response = await call_next(request)
    response.headers.update(_rate_limit_headers(calls, count, reset_ts))
    return response
