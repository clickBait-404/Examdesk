"""
ExamDesk — Redis Client
Async Redis connection (Upstash-compatible, TLS via `rediss://`) used for
caching and other ephemeral, fast-access data.
"""

import logging
from typing import Optional

import redis.asyncio as redis

from config import settings

logger = logging.getLogger("examdesk")

_redis_client: Optional[redis.Redis] = None


async def connect_redis() -> None:
    """Create the Redis connection pool. Call once on app startup.
    Never raises — a missing/invalid REDIS_URL or unreachable Redis
    should degrade to "no cache", not crash the app.
    """
    global _redis_client
    try:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        await _redis_client.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        _redis_client = None
        logger.warning(f"⚠️  Redis unavailable, continuing without cache: {e}")


async def disconnect_redis() -> None:
    """Close the Redis connection pool. Call once on app shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        logger.info("🛑 Redis disconnected")


def get_redis() -> Optional[redis.Redis]:
    """
    Returns the shared Redis client, or None if Redis is unavailable.
    Callers must handle the None case gracefully (cache is best-effort,
    never a hard dependency for correctness).
    """
    return _redis_client