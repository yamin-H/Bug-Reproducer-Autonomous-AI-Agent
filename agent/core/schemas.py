from pydantic import BaseModel, HttpUrl

class RunJobRequest(BaseModel):
    job_id: str
    issue_url: str
    github_token: str