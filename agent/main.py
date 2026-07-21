from fastapi import FastAPI, BackgroundTasks
from core.config import get_settings
from core.schemas import RunJobRequest
from graph.agent import agent
import requests
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
# Allow the deployed Vercel frontend + localhost for development
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

def run_agent(request: RunJobRequest):
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
        "fix_code": "",
        "fixed_file_path": "",
        "fix_verified": False,
        "pr_url": "",
        "retry_count": 0,
        "error": None
    }
    
    try:
        result = agent.invoke(initial_state)
        if result.get("pr_url"):
            requests.post(
                f"{NODE_API_URL}/api/jobs/{request.job_id}/complete",
                json={
                    "status": "SUCCESS",
                    "prUrl": result.get("pr_url"),
                    "testCode": result.get("test_code"),
                    "fixCode": result.get("fix_code"),
                    "fixedFilePath": result.get("fixed_file_path"),
                },
                timeout=10
            )
        else:
            requests.post(
                f"{NODE_API_URL}/api/jobs/{request.job_id}/complete",
                json={
                    "status": "FAILED",
                    "errorMessage": result.get("error") or "Agent stopped without opening PR"
                },
                timeout=10
            )
    except Exception as e:
        print(f"[Agent] Error: {e}")
        requests.post(
            f"{NODE_API_URL}/api/jobs/{request.job_id}/complete",
            json={
                "status": "FAILED",
                "errorMessage": str(e)
            },
            timeout=10
        )


@app.get("/health")
def health():
    return {
        "status": "ok", 
        "service": "bug-reproducer-agent",
        "environment": settings.environment
    }

@app.post("/run")
async def run_job(request: RunJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_agent, request)
    return {
        "message": "job started",
        "job_id": request.job_id
    }