"""LangGraph node: run the test in a sandbox to confirm the bug exists."""

import os
import logging
import shutil

from graph.state import AgentState
from core.utils import parse_github_url
from core.sandbox import (
    download_and_extract_repo,
    install_dependencies,
    run_pytest,
    write_file,
    is_setup_error,
    make_github_api_headers,
)
from services.publisher import publish_log

logger = logging.getLogger(__name__)


def run_test(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Running test in sandbox", "running")
    logger.info("[Node 4] Setting up sandbox...")

    owner, repo, _ = parse_github_url(state["repo_url"])
    repo_dir = None

    try:
        repo_dir = download_and_extract_repo(owner, repo, state["github_token"])

        # Write the test file into the repo
        write_file(repo_dir, "test_bug_reproduction.py", state["test_code"])

        # Install dependencies
        install_dependencies(repo_dir)

        # Run the test
        result = run_pytest(repo_dir)
        test_output = result.stdout + result.stderr

        logger.info("[Node 4] Test exit code: %d", result.returncode)
        logger.info("[Node 4] Test output:\n%s", test_output[:1000])

        # Interpret the result
        test_error = ""
        test_passed = False

        if result.returncode == 1:
            # Test failed — this confirms the bug
            if is_setup_error(test_output):
                test_error = test_output
                logger.warning("[Node 4] Test has setup/syntax error — need to rewrite")
                publish_log(
                    state["job_id"], "Running test in sandbox", "error",
                    "Test has setup/syntax error — rewriting"
                )
            else:
                logger.info("[Node 4] Bug confirmed — test fails as expected")
                publish_log(
                    state["job_id"], "Running test in sandbox", "done",
                    "Bug confirmed — test fails as expected"
                )

        elif result.returncode == 0:
            test_error = "Test passed unexpectedly — the bug was not reproduced"
            logger.warning("[Node 4] Test passed — bug not reproduced")
            publish_log(
                state["job_id"], "Running test in sandbox", "error",
                "Test passed — bug not reproduced"
            )

        else:
            test_error = test_output
            logger.error("[Node 4] Could not run test — exit code %d", result.returncode)
            publish_log(
                state["job_id"], "Running test in sandbox", "error",
                f"Test error — exit code {result.returncode}"
            )

        test_passed = result.returncode == 0

        return {
            "test_output": test_output,
            "test_passed": test_passed,
            "test_error": test_error,
        }

    finally:
        # Clean up temp directory
        if repo_dir and os.path.exists(repo_dir):
            shutil.rmtree(os.path.dirname(repo_dir), ignore_errors=True)
