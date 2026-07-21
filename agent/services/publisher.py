import redis
import json
import time
import ssl
from core.config import get_settings

settings = get_settings()

# Use ssl_context to disable cert verification for Upstash (rediss://)
# ssl_cert_reqs was removed in redis-py >= 4.x; ssl_context is the correct API
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

redis_client = redis.from_url(
    settings.redis_url,
    ssl_context=_ssl_ctx
)

def publish_log(job_id: str, step: str, status: str, detail: str = ""):
    """
    Publish a log message to Redis pub/sub channel for a job.
    status options:
    - "running"   → step is currently executing
    - "done"      → step completed successfully
    - "error"     → step failed

    """

    message = json.dumps({
        "step" : step,
        "status": status,
        "detail": detail,
        "timestamp" : time.time()
    })

    channel = f"job:{job_id}:logs"
    redis_client.publish(channel, message)
    print(f"[Publisher] {channel} → {step}: {status}")