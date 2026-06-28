import requests
from graph.state import AgentState
from core.utils import parse_github_url
from services.llm import ask_llm
from services.publisher import publish_log

def fetch_file_content(owner: str, repo: str, file_path: str, github_token: str) -> str:
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
        headers=headers
    )

    if response.status_code != 200:
        return ""

    data = response.json()

    import base64
    content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
    return content

def write_test(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Writing test", "running")
    print(f"[Node 3] Fetching content of {len(state['relevant_files'])} files...")

    owner, repo, _ = parse_github_url(state["repo_url"])

    # Fetch content of every relevant file
    files_with_content = []
    for file in state["relevant_files"]:
        content = fetch_file_content(owner, repo, file["path"], state["github_token"])
        if content:
            files_with_content.append({
                "path": file["path"],
                "content": content
            })
            print(f"  → fetched {file['path']} ({len(content)} chars)")

    print(f"[Node 3] Successfully fetched {len(files_with_content)} files")
    print(f"[Node 3] Asking LLM to write failing test...")

    # Build file contents section for prompt
    files_context = ""
    for file in files_with_content:
        files_context += f"\n\n--- {file['path']} ---\n{file['content'][:3000]}"

    feedback_section = ""
    if state.get("test_error") and state.get("retry_count", 0) > 0:
        feedback_section = f"""
        PREVIOUS ATTEMPT FAILED:
        The previous test you wrote had this error:
        {state['test_error'][:1000]}

        Fix these issues in your new test."""

    prompt = f"""You are a senior Python engineer. Your job is to write a test that reproduces a bug.

            Bug title: {state['issue_title']}

            Bug description:
            {state['issue_body'][:2000]}

            Issue comments (extra context):
            {chr(10).join(state['issue_comments'][:3])}

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

    print(f"[Node 3] Test written ({len(test_code)} chars)")
    print(f"[Node 3] Generated test preview:")
    print(test_code[:500])
    publish_log(state["job_id"], "Writing failing test", "done", "Test generated successfully")

    return {
        "relevant_files": files_with_content,
        "test_code": test_code
    }