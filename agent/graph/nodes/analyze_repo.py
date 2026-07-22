"""LangGraph node: analyze repository structure to find relevant files."""

import json
import logging

import requests
from graph.state import AgentState
from core.utils import parse_github_url
from core.sandbox import make_github_api_headers
from services.llm import ask_llm
from services.publisher import publish_log

logger = logging.getLogger(__name__)

IGNORE_PATTERNS = [
    "node_modules", ".git", "__pycache__", ".next",
    "dist", "build", ".cache", "coverage",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".lock", ".sum", ".mod",
    ".min.js", ".min.css",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]

LANGUAGE_EXTENSIONS = {
    "TypeScript": [".ts", ".tsx"],
    "JavaScript": [".js", ".jsx", ".mjs", ".cjs"],
    "Python": [".py"],
    "Java": [".java"],
    "Go": [".go"],
    "Rust": [".rs"],
    "Ruby": [".rb"],
    "PHP": [".php"],
    "C#": [".cs"],
    "C++": [".cpp", ".cc", ".h", ".hpp"],
    "C": [".c", ".h"],
}


def should_ignore(file_path: str) -> bool:
    return any(pattern in file_path for pattern in IGNORE_PATTERNS)


def filter_by_language(files: list[str], language: str) -> list[str]:
    extensions = LANGUAGE_EXTENSIONS.get(language)
    if not extensions:
        return files
    return [f for f in files if any(f.endswith(ext) for ext in extensions)]


def analyze_repo(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Analyzing repository", "running")
    logger.info("[Node 2] Fetching file tree for: %s", state["repo_url"])

    owner, repo, _ = parse_github_url(state["repo_url"])
    headers = make_github_api_headers(state["github_token"])

    tree_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1",
        headers=headers,
        timeout=30,
    )

    if tree_response.status_code != 200:
        publish_log(state["job_id"], "Analyzing repository", "error",
                    f"Failed: {tree_response.status_code}")
        return {
            **state,
            "error": f"Failed to fetch file tree: {tree_response.status_code}",
        }

    tree_data = tree_response.json()
    all_files = [
        item["path"]
        for item in tree_data.get("tree", [])
        if item["type"] == "blob"
    ]

    meaningful_files = [f for f in all_files if not should_ignore(f)]
    language_filtered = filter_by_language(meaningful_files, state["repo_language"])

    logger.info(
        "[Node 2] Total: %d | Filtered: %d | Language: %d",
        len(all_files), len(meaningful_files), len(language_filtered),
    )

    # Limit file list to prevent LLM context overflow (Groq Llama 70B has ~8k limit)
    MAX_FILES_IN_PROMPT = 300
    if len(language_filtered) > MAX_FILES_IN_PROMPT:
        logger.warning(
            "[Node 2] Truncating file list from %d to %d to avoid context overflow",
            len(language_filtered), MAX_FILES_IN_PROMPT,
        )
        # Try to prioritize files that match keywords from issue title
        keywords = state.get("issue_title", "").lower().split()
        scored = []
        for f in language_filtered:
            score = sum(1 for kw in keywords if kw in f.lower())
            scored.append((score, f))
        scored.sort(key=lambda x: (-x[0], x[1]))
        language_filtered = [f for _, f in scored][:MAX_FILES_IN_PROMPT]

    file_list_text = "\n".join(language_filtered)

    prompt = f"""You are analyzing a GitHub repository to find files relevant to this bug.

Bug title: {state['issue_title']}
Bug description: {state['issue_body'][:1000]}

Repository files ({len(language_filtered)} total):
{file_list_text}

Return ONLY a JSON array of the 10-15 most relevant file paths. No explanation. No markdown. No code blocks.
Example: ["path/to/file1.py", "path/to/file2.py"]"""

    response = ask_llm(prompt)

    try:
        clean = response.replace("```json", "").replace("```", "").strip()
        relevant_paths = json.loads(clean)
        if not isinstance(relevant_paths, list):
            raise ValueError("Not a list")
    except Exception:
        logger.warning("[Node 2] Could not parse LLM response, using first 15 files")
        relevant_paths = language_filtered[:15]

    logger.info("[Node 2] LLM selected %d relevant files:", len(relevant_paths))
    for f in relevant_paths:
        logger.info("  → %s", f)

    publish_log(state["job_id"], "Analyzing repository", "done",
                f"Found {len(relevant_paths)} relevant files")

    return {
        "relevant_files": [{"path": p, "content": ""} for p in relevant_paths],
    }
