import json
import requests
from graph.state import AgentState
from core.utils import parse_github_url
from services.llm import ask_llm
from services.publisher import publish_log

IGNORE_PATTERNS = [
    "node_modules", ".git", "__pycache__", ".next",
    "dist", "build", ".cache", "coverage",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".lock", ".sum", ".mod",
    ".min.js", ".min.css",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml"
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
    for pattern in IGNORE_PATTERNS:
        if pattern in file_path:
            return True
    return False

def filter_by_language(files: list[str], language: str) -> list[str]:
    extensions = LANGUAGE_EXTENSIONS.get(language)
    if not extensions:
        return files
    return [f for f in files if any(f.endswith(ext) for ext in extensions)]

def analyze_repo(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Analyzing repository", "running")
    print(f"[Node 2] Fetching file tree for: {state['repo_url']}")

    owner, repo, _ = parse_github_url(state["repo_url"])

    headers = {
        "Authorization": f"Bearer {state['github_token']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    tree_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1",
        headers=headers
    )

    if tree_response.status_code != 200:
        publish_log(state["job_id"], "Analyzing repository", "error", f"Failed: {tree_response.status_code}")
        return {
            **state,
            "error": f"Failed to fetch file tree: {tree_response.status_code}"
        }

    tree_data = tree_response.json()
    all_files = [
        item["path"]
        for item in tree_data.get("tree", [])
        if item["type"] == "blob"
    ]

    meaningful_files = [f for f in all_files if not should_ignore(f)]
    language_filtered = filter_by_language(meaningful_files, state["repo_language"])

    print(f"[Node 2] Total: {len(all_files)} | Noise filtered: {len(meaningful_files)} | Language filtered: {len(language_filtered)}")
    print(f"[Node 2] Asking LLM to find relevant files...")

    file_list_text = "\n".join(language_filtered)

    prompt = f"""You are analyzing a GitHub repository to find files relevant to this bug.

Bug title: {state['issue_title']}
Bug description: {state['issue_body'][:1000]}

Repository files:
{file_list_text}

Return ONLY a JSON array of 10-15 most relevant file paths. No explanation. No markdown. No code blocks.
Example: ["path/to/file1.py", "path/to/file2.py"]"""

    response = ask_llm(prompt)

    try:
        clean = response.replace("```json", "").replace("```", "").strip()
        relevant_paths = json.loads(clean)
        if not isinstance(relevant_paths, list):
            raise ValueError("Not a list")
    except Exception:
        print(f"[Node 2] Warning: could not parse LLM response, using first 15 files")
        relevant_paths = language_filtered[:15]

    print(f"[Node 2] LLM selected {len(relevant_paths)} relevant files:")
    for f in relevant_paths:
        print(f"  → {f}")
    publish_log(state["job_id"], "Analyzing repository", "done", f"Found {len(relevant_paths)} relevant files")

    return {
        "relevant_files": [{"path": f, "content": ""} for f in relevant_paths]
    }