"""FastAPI entry point for the Bug Reproducer agent."""

import os
import logging

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.schemas import RunJobRequest
from core.log_config import configure_logging
from graph.agent import agent

logger = logging.getLogger(__name__)

# Configure structured logging on import
configure_logging()

app = FastAPI(title="Bug Reproducer Agent", version="1.0.0")

# CORS: allow the deployed frontend + localhost for development
_frontend_origins = os.environ.get("FRONTEND_URL", "http://localhost:3000").split(",")
if "http://localhost:3000" not in _frontend_origins:
    _frontend_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
settings = get_settings()
NODE_API_URL = os.environ.get("NODE_API_URL", "http://localhost:3001")

import requests


def run_agent(request: RunJobRequest):
    """Run the LangGraph agent in the background and report results."""
    initial_state = {
        "job_id": request.job_id,
        "issue_url": request.issue_url,
        "github_token": request.github_token,
        "issue_title": "",
        "issue_body": "",
        "issue_comments": [],
        "repo_url": "",
        "repo_language": "",
        "relevant_files": [],
        "test_code": "",
        "test_output": "",
        "test_passed": False,
        "test_error": "",
        "fix_code": "",
        "fixed_file_path": "",
        "fix_verified": False,
        "fix_retry_count": 0,
        "pr_url": "",
        "retry_count": 0,
        "error": None,
    }

    try:
        result = agent.invoke(initial_state)
        if result.get("pr_url"):
            _notify_complete(request.job_id, "SUCCESS", pr_url=result["pr_url"],
                             test_code=result.get("test_code"),
                             fix_code=result.get("fix_code"),
                             fixed_file_path=result.get("fixed_file_path"))
        else:
            _notify_complete(request.job_id, "FAILED",
                             error_message=result.get("error") or "Agent stopped without opening PR")
    except Exception as e:
        logger.exception("Agent execution failed: %s", e)
        _notify_complete(request.job_id, "FAILED", error_message=str(e))


def _notify_complete(job_id: str, status: str, **kwargs):
    """Notify the Node.js API that the job completed."""
    payload = {"status": status}
    payload.update(kwargs)
    try:
        resp = requests.post(
            f"{NODE_API_URL}/api/jobs/{job_id}/complete",
            json=payload,
            timeout=10,
        )
        logger.info("Job %s completion notified to API: %s", job_id, resp.status_code)
    except requests.RequestException as e:
        logger.error("Failed to notify API for job %s: %s", job_id, e)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "bug-reproducer-agent",
        "environment": settings.environment,
    }


@app.post("/run")
async def run_job(request: RunJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_agent, request)
    logger.info("Job %s started for issue: %s", request.job_id, request.issue_url)
    return {"message": "job started", "job_id": request.job_id}
