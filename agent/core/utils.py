import re

def parse_github_url(url: str) -> tuple[str, str, int | None]:
    issue_pattern = r"https://github\.com/([^/]+)/([^/]+)/issues/(\d+)"
    repo_pattern = r"https://github\.com/([^/]+)/([^/]+)"

    issue_match = re.match(issue_pattern, url)
    if issue_match:
        return issue_match.group(1), issue_match.group(2), int(issue_match.group(3))

    repo_match = re.match(repo_pattern, url)
    if repo_match:
        return repo_match.group(1), repo_match.group(2), None

    raise ValueError(f"Invalid GitHub URL: {url}")