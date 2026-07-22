from langgraph.graph import StateGraph, START, END
from graph.state import AgentState
from graph.nodes.fetch_issue import fetch_issue
from graph.nodes.analyze_repo import analyze_repo
from graph.nodes.write_test import write_test
from graph.nodes.run_test import run_test
from graph.nodes.write_fix import write_fix
from graph.nodes.verify_fix import verify_fix
from graph.nodes.open_pr import open_pr

MAX_RETRIES = 3
MAX_FIX_RETRIES = 3

def decide_after_test(state: AgentState) -> str:
    """Decide next step after running a test.

    - If the test has setup/syntax errors: retry writing it (up to MAX_RETRIES).
    - If the test passed (bug NOT reproduced): end — the issue was not reproduced.
    - If the test failed (bug confirmed): proceed to write a fix.
    """
    if state.get("test_error"):
        if state.get("retry_count", 0) >= MAX_RETRIES:
            print(f"[Agent] Max test retries reached — stopping")
            return "end"
        print(f"[Agent] Test had errors — rewriting test (attempt {state.get('retry_count', 0) + 1})")
        return "rewrite_test"

    if state.get("test_passed"):
        print(f"[Agent] Test passed — bug was not reproduced. Ending.")
        return "end"

    print(f"[Agent] Bug confirmed — proceeding to write fix")
    return "write_fix"

def decide_after_verify(state: AgentState) -> str:
    """Decide next step after verifying a fix."""
    if state.get("fix_verified"):
        return "open_pr"

    fix_attempts = state.get("fix_retry_count", 0)
    if fix_attempts >= MAX_FIX_RETRIES:
        print(f"[Agent] Max fix retries reached — stopping")
        return "end"

    print(f"[Agent] Fix did not work — retrying (attempt {fix_attempts + 1})")
    return "retry_fix"

def increment_retry(state: AgentState) -> dict:
    return {
        "retry_count": state.get("retry_count", 0) + 1,
        "test_error": state.get("test_error", ""),
        "test_code": "",
    }

def increment_fix_retry(state: AgentState) -> dict:
    return {
        "fix_retry_count": state.get("fix_retry_count", 0) + 1,
        "fix_code": "",
        "fixed_file_path": "",
    }

def create_agent():
    graph = StateGraph(AgentState)

    graph.add_node("fetch_issue", fetch_issue)
    graph.add_node("analyze_repo", analyze_repo)
    graph.add_node("write_test", write_test)
    graph.add_node("run_test", run_test)
    graph.add_node("increment_retry", increment_retry)
    graph.add_node("write_fix", write_fix)
    graph.add_node("verify_fix", verify_fix)
    graph.add_node("increment_fix_retry", increment_fix_retry)
    graph.add_node("open_pr", open_pr)

    graph.add_edge(START, "fetch_issue")
    graph.add_edge("fetch_issue", "analyze_repo")
    graph.add_edge("analyze_repo", "write_test")
    graph.add_edge("write_test", "run_test")

    graph.add_conditional_edges("run_test", decide_after_test, {
        "write_fix": "write_fix",
        "rewrite_test": "increment_retry",
        "end": END
    })

    graph.add_edge("increment_retry", "write_test")
    graph.add_edge("write_fix", "verify_fix")

    graph.add_conditional_edges("verify_fix", decide_after_verify, {
        "open_pr": "open_pr",
        "retry_fix": "increment_fix_retry",
        "end": END
    })

    graph.add_edge("increment_fix_retry", "write_fix")
    graph.add_edge("open_pr", END)

    return graph.compile()

agent = create_agent()