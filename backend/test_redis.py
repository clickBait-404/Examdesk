"""
Quick standalone Redis connectivity check.
Run: python test_redis.py
"""
import asyncio
from config import settings
import redis.asyncio as redis


async def main():
    print(f"Connecting to: {settings.REDIS_URL.split('@')[-1]}")  # hides credentials
    client = redis.from_url(settings.REDIS_URL, decode_responses=True)

    pong = await client.ping()
    print(f"PING -> {pong}")

    await client.set("examdesk_test_key", "hello", ex=30)
    value = await client.get("examdesk_test_key")
    print(f"SET/GET -> {value}")

    await client.close()
    print("✅ Redis is working correctly.")


if __name__ == "__main__":
    asyncio.run(main())