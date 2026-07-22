"""Redis pub/sub publisher for real-time job log streaming.

Uses individual SSL parameters for redis-py 4.x compatibility
(the ssl_context parameter was added in redis-py 5.x).
"""

import json
import logging
import os
from urllib.parse import urlparse

import redis as redis_lib

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")


def _create_redis_client() -> redis_lib.Redis:
    """Create a Redis client compatible with redis-py 4.x.

    For rediss:// URLs, we use individual ssl_ parameters instead
    of ssl_context (which requires redis-py >= 5.x).
    """
    if REDIS_URL.startswith("rediss://"):
        parsed = urlparse(REDIS_URL)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        password = parsed.password

        ssl_cert_reqs = "none" if ENVIRONMENT == "development" else "required"
        if ENVIRONMENT == "development":
            logger.warning("Redis SSL cert verification disabled (development mode)")

        return redis_lib.Redis(
            host=host,
            port=port,
            password=password,
            ssl=True,
            ssl_cert_reqs=ssl_cert_reqs,
            decode_responses=False,
        )

    # Plain redis:// URL — no SSL
    return redis_lib.from_url(REDIS_URL)


redis_client = _create_redis_client()


def publish_log(job_id: str, step: str, status: str, detail: str = ""):
    """Publish a log message to Redis pub/sub channel for a job.

    status options:
    - "running" → step is currently executing
    - "done"    → step completed successfully
    - "error"   → step failed
    """
    message = json.dumps({
        "step": step,
        "status": status,
        "detail": detail,
        "timestamp": __import__("time").time(),
    })

    channel = f"job:{job_id}:logs"
    try:
        redis_client.publish(channel, message)
        logger.debug("[Publisher] %s → %s: %s", channel, step, status)
    except Exception as e:
        logger.error("[Publisher] Failed to publish to %s: %s", channel, e)
