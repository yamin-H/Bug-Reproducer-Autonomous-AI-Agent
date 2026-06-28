import redis
import json
import time
from core.config import get_settings

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)

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