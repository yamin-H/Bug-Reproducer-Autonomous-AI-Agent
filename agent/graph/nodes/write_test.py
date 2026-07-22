"""LangGraph node: write a failing test that reproduces the bug."""

import base64
import logging

import requests
from graph.state import AgentState
from core.utils import parse_github_url
from core.sandbox import make_github_api_headers
from services.llm import ask_llm
from services.publisher import publish_log

logger = logging.getLogger(__name__)


def fetch_file_content(owner: str, repo: str, file_path: str, github_token: str) -> str:
    """Fetch a single file's content from GitHub API (base64 decoded)."""
    headers = make_github_api_headers(github_token)
    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
        headers=headers,
        timeout=30,
    )
    if response.status_code != 200:
        return ""
    data = response.json()
    content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
    return content


def _sanitize_llm_input(text: str, max_length: int = 2000) -> str:
    """Sanitize user-provided text before injecting into an LLM prompt.

    Truncates to max_length and strips control characters that could
    interfere with prompt boundaries.
    """
    clean = "".join(c for c in (text or "") if c.isprintable() or c in "\n\r\t")
    return clean[:max_length]


def write_test(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Writing test", "running")
    logger.info("[Node 3] Fetching content of %d files...", len(state["relevant_files"]))

    owner, repo, _ = parse_github_url(state["repo_url"])

    # Fetch content of every relevant file
    files_with_content = []
    for file in state["relevant_files"]:
        content = fetch_file_content(
            owner, repo, file["path"], state["github_token"]
        )
        if content:
            files_with_content.append({"path": file["path"], "content": content})
            logger.info("  → fetched %s (%d chars)", file["path"], len(content))

    logger.info("[Node 3] Successfully fetched %d files", len(files_with_content))

    # Build file contents section for prompt
    # Limit total context to prevent LLM context overflow
    MAX_CONTEXT_CHARS = 25000
    files_context = ""
    for file in files_with_content:
        chunk = f"\n\n--- {file['path']} ---\n{file['content'][:3000]}"
        if len(files_context) + len(chunk) > MAX_CONTEXT_CHARS:
            logger.warning("[Node 3] Truncating file context at %d chars to avoid overflow", MAX_CONTEXT_CHARS)
            break
        files_context += chunk

    # Sanitize all user-provided inputs
    issue_title = _sanitize_llm_input(state["issue_title"], 200)
    issue_body = _sanitize_llm_input(state["issue_body"], 2000)
    issue_comments = [
        _sanitize_llm_input(c, 1000) for c in state.get("issue_comments", [])
    ]

    feedback_section = ""
    if state.get("test_error") and state.get("retry_count", 0) > 0:
        test_error = _sanitize_llm_input(state["test_error"], 1000)
        feedback_section = f"""
        PREVIOUS ATTEMPT FAILED:
        The previous test you wrote had this error:
        {test_error}

        Fix these issues in your new test."""

    prompt = f"""You are a senior Python engineer. Your job is to write a test that reproduces a bug.

Bug title: {issue_title}

Bug description:
{issue_body}

Issue comments (extra context):
{chr(10).join(issue_comments[:3])}

Relevant source files:
{files_context}
{feedback_section}

Write a pytest test that:
1. Write ONLY ONE test function
2. The test asserts ONLY the CORRECT expected behavior
3. Do NOT assert the buggy behavior anywhere in the test
4. The test must FAIL on the current buggy code naturally
5. The test must PASS once the bug is fixed
6. Use only necessary imports
7. No tmp_path unless you actually need a temporary file or directory

HOW TO THINK ABOUT THIS:
- Read the bug description carefully
- Understand what the CORRECT behavior should be after fix
- Write assertions that check for that CORRECT behavior
- The test will fail automatically because the bug makes correct behavior impossible right now

EXAMPLE of correct thinking:
- Bug says: function returns wrong value
- Correct behavior: function should return X for input Y
- Write: assert function(Y) == X
- Do NOT write: assert function(Y) == wrong_value

Return ONLY the Python test code. No explanation. No markdown. No code blocks."""

    test_code = ask_llm(prompt)

    # Clean up if LLM adds markdown anyway
    test_code = test_code.replace("```python", "").replace("```", "").strip()

    logger.info("[Node 3] Test written (%d chars)", len(test_code))
    logger.info("[Node 3] Generated test preview:\n%s", test_code[:500])
    publish_log(state["job_id"], "Writing failing test", "done",
                "Test generated successfully")

    return {
        "relevant_files": files_with_content,
        "test_code": test_code,
    }
