"""LangGraph node: generate a code fix for the bug."""

import logging

from graph.state import AgentState
from services.llm import ask_llm
from services.publisher import publish_log

logger = logging.getLogger(__name__)


def write_fix(state: AgentState) -> dict:
    publish_log(state["job_id"], "Writing fix", "running")
    logger.info("[Node 5] Writing fix...")

    files_context = ""
    MAX_CONTEXT_CHARS = 25000
    for file in state["relevant_files"]:
        chunk = f"\n\n--- {file['path']} ---\n{file['content'][:3000]}"
        if len(files_context) + len(chunk) > MAX_CONTEXT_CHARS:
            logger.warning("[Node 5] Truncating file context at %d chars to avoid overflow", MAX_CONTEXT_CHARS)
            break
        files_context += chunk

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
        if "FILE_PATH:" not in response or "EXPLANATION:" not in response or "FIXED_CONTENT:" not in response:
            logger.warning("[Node 5] Could not parse LLM response format")
            return {"error": "Could not parse fix from LLM response"}

        parts = response.split("FILE_PATH:")
        rest = parts[1]

        file_path_part, rest = rest.split("EXPLANATION:", 1)
        explanation_part, fixed_content_part = rest.split("FIXED_CONTENT:", 1)

        file_path = file_path_part.strip()
        explanation = explanation_part.strip()
        fixed_content = fixed_content_part.strip()
        fixed_content = fixed_content.replace("```python", "").replace("```", "").strip()

        logger.info("[Node 5] Fix generated:")
        logger.info("  → File: %s", file_path)
        logger.info("  → Explanation: %s", explanation)
        logger.info("  → Fixed content: %d chars", len(fixed_content))
        publish_log(state["job_id"], "Writing fix", "done",
                    f"Fix generated for {file_path}")

        return {"fix_code": fixed_content, "fixed_file_path": file_path}

    except Exception as e:
        logger.exception("[Node 5] Error parsing response: %s", e)
        return {"error": f"Failed to parse fix: {str(e)}"}
