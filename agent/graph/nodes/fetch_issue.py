"""LangGraph node: fetch issue details from GitHub."""

import logging

import requests
from graph.state import AgentState
from core.utils import parse_github_url
from core.sandbox import make_github_api_headers
from services.publisher import publish_log

logger = logging.getLogger(__name__)


def fetch_issue(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Fetching issue", "running")
    logger.info("[Node 1] Fetching issue: %s", state["issue_url"])
    owner, repo, issue_number = parse_github_url(state["issue_url"])

    headers = make_github_api_headers(state["github_token"])

    # Fetch issue
    issue_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
        headers=headers,
        timeout=30,
    )
    if issue_response.status_code != 200:
        return {
            "error": f"Failed to fetch issue: {issue_response.status_code} {issue_response.text}"
        }

    issue_data = issue_response.json()

    # Fetch comments (handles pagination — fetches up to 100 comments)
    comments: list[str] = []
    comments_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments"
    params: dict = {"per_page": 100, "page": 1}

    while comments_url:
        comments_response = requests.get(comments_url, headers=headers, params=params, timeout=30)
        if comments_response.status_code == 200:
            page_comments = comments_response.json()
            comments.extend(c["body"] for c in page_comments if c.get("body"))
            # Check for next page via Link header
            link_header = comments_response.headers.get("Link", "")
            if 'rel="next"' in link_header:
                # Extract next page URL from Link header
                import re
                match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
                comments_url = match.group(1) if match else None
                params = {}  # params embedded in URL
            else:
                comments_url = None
        else:
            comments_url = None

    # Fetch repo info
    repo_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}",
        headers=headers,
        timeout=30,
    )
    repo_language = "unknown"
    if repo_response.status_code == 200:
        repo_language = repo_response.json().get("language") or "unknown"

    logger.info(
        "[Node 1] Done — '%s' | Language: %s | Comments: %d",
        issue_data["title"], repo_language, len(comments),
    )

    return {
        "issue_title": issue_data["title"],
        "issue_body": issue_data.get("body") or "",
        "issue_comments": comments,
        "repo_url": f"https://github.com/{owner}/{repo}",
        "repo_language": repo_language,
    }
