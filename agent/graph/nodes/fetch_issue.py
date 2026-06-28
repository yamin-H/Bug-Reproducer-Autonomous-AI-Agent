from graph.state import AgentState
import requests
from core.utils import parse_github_url
from services.publisher import publish_log

def fetch_issue(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Fetching issue", "running")
    print(f"[Node 1] Fetching issue: {state['issue_url']}")
    owner, repo, issue_number = parse_github_url(state['issue_url'])

    headers = {
        "Authorization": f"Bearer {state['github_token']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    issue_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}", headers=headers)
    if issue_response.status_code != 200:
        return {
            "error": f"Failed to fetch issue: {issue_response.status_code} {issue_response.text}"
        }
    
    comments = []
    issue_data = issue_response.json()
    comments_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments",
        headers=headers
    )

    if comments_response.status_code == 200:
        comments = [c['body'] for c in comments_response.json()]
    
    repo_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}",
        headers=headers
    )

    repo_language = "unknown"
    if repo_response.status_code == 200:
        repo_language = repo_response.json().get("language") or "unknown"

    print(f"[Node 1] Done — '{issue_data['title']}' | Language: {repo_language}")
    return {
    "issue_title": issue_data["title"],
    "issue_body": issue_data["body"] or "",
    "issue_comments": comments,
    "repo_url": f"https://github.com/{owner}/{repo}",
    "repo_language": repo_language
    }