"""LangGraph node: apply the fix and verify it passes the test."""

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
    make_github_api_headers,
)
from services.publisher import publish_log

logger = logging.getLogger(__name__)


def verify_fix(state: AgentState) -> dict:
    publish_log(state["job_id"], "Verifying fix", "running")
    logger.info("[Node 6] Verifying fix...")

    owner, repo, _ = parse_github_url(state["repo_url"])
    repo_dir = None

    try:
        repo_dir = download_and_extract_repo(owner, repo, state["github_token"])

        # Apply the fix
        if not state.get("fixed_file_path"):
            logger.error("[Node 6] No fixed file path provided")
            publish_log(state["job_id"], "Verifying fix", "error", "No file path to fix")
            return {"fix_verified": False}

        logger.info("[Node 6] Applying fix to: %s", state["fixed_file_path"])
        write_file(repo_dir, state["fixed_file_path"], state["fix_code"])

        # Write the test file
        write_file(repo_dir, "test_bug_reproduction.py", state["test_code"])

        # Install dependencies
        install_dependencies(repo_dir)

        # Run the test
        result = run_pytest(repo_dir)
        verify_output = result.stdout + result.stderr

        logger.info("[Node 6] Verify exit code: %d", result.returncode)

        # Fix is verified if the test suite passes
        fix_verified = result.returncode == 0

        if fix_verified:
            logger.info("[Node 6] Fix verified — all tests pass")
            publish_log(state["job_id"], "Verifying fix", "done", "Fix works — all tests pass")
        else:
            logger.warning("[Node 6] Fix did not work — test still failing")
            publish_log(state["job_id"], "Verifying fix", "error", "Fix did not work")

        return {
            "fix_verified": fix_verified,
            "test_output": verify_output,
        }

    except Exception as e:
        logger.exception("[Node 6] Error during verification: %s", e)
        publish_log(state["job_id"], "Verifying fix", "error", str(e))
        return {"fix_verified": False}

    finally:
        # Clean up temp directory
        if repo_dir and os.path.exists(repo_dir):
            shutil.rmtree(os.path.dirname(repo_dir), ignore_errors=True)
