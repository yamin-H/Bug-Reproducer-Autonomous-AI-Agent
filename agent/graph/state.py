from typing import TypedDict, Optional

class AgentState(TypedDict):
    job_id: str
    issue_url: str
    github_token: str
    issue_title: str
    issue_body: str
    issue_comments: list[str]
    repo_url: str
    repo_language: str
    relevant_files: list[dict]
    test_code: str
    test_output: str
    test_passed: bool
    test_error: str 
    fix_code: str
    fixed_file_path: str
    fix_verified: bool
    fix_retry_count: int 
    pr_url: str
    retry_count: int
    error: Optional[str]