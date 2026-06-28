from graph.state import AgentState
from pydantic import BaseModel
from services.llm import ask_llm
from services.publisher import publish_log

class FixResult(BaseModel):
    file_path: str
    fixed_content: str
    explanation: str

def write_fix(state: AgentState) -> dict:
    publish_log(state["job_id"], "Writing fix", "running")
    print(f"[Node 5] Writing fix...")

    files_context = ""
    for file in state["relevant_files"]:
        files_context += f"\n\n--- {file['path']} ---\n{file['content'][:3000]}"

    prompt = f"""You are a senior software engineer fixing a bug.

        Bug title: {state['issue_title']}

        Bug description:
        {state['issue_body'][:2000]}

        Failing test that proves the bug exists:
        {state['test_code']}

        Exact test failure output:
        {state['test_output'][:1000]}

        Relevant source files:
        {files_context}

        Respond in EXACTLY this format with these exact separators:

        FILE_PATH:
        cookiecutter/repository.py

        EXPLANATION:
        Brief explanation of what you changed and why.

        FIXED_CONTENT:
        <complete fixed file content here, no markdown, no backticks>"""

    response = ask_llm(prompt)

    try:
        file_path = ""
        explanation = ""
        fixed_content = ""

        if "FILE_PATH:" in response and "EXPLANATION:" in response and "FIXED_CONTENT:" in response:
            parts = response.split("FILE_PATH:")
            rest = parts[1]

            file_path_part, rest = rest.split("EXPLANATION:", 1)
            explanation_part, fixed_content_part = rest.split("FIXED_CONTENT:", 1)

            file_path = file_path_part.strip()
            explanation = explanation_part.strip()
            fixed_content = fixed_content_part.strip()
            fixed_content = fixed_content.replace("```python", "").replace("```", "").strip()

        else:
            print(f"[Node 5] Warning: could not parse LLM response format")
            return {"error": "Could not parse fix from LLM response"}

        print(f"[Node 5] Fix generated:")
        print(f"  → File: {file_path}")
        print(f"  → Explanation: {explanation}")
        print(f"  → Fixed content: {len(fixed_content)} chars")
        publish_log(state["job_id"], "Writing fix", "done", f"Fix generated for {file_path}")

        return {
            "fix_code": fixed_content,
            "fixed_file_path": file_path,
        }

    except Exception as e:
        print(f"[Node 5] Error parsing response: {e}")
        return {"error": f"Failed to parse fix: {str(e)}"}