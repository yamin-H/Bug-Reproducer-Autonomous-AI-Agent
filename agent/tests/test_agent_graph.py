"""Tests for the LangGraph agent logic (state transitions and retry decisions)."""

from graph.agent import (
    decide_after_test,
    decide_after_verify,
    increment_retry,
    increment_fix_retry,
    MAX_RETRIES,
    MAX_FIX_RETRIES,
)
from graph.state import AgentState

# ─── Default state for testing ────────────────────────────────────────

BASE_STATE: AgentState = {
    "job_id": "test-123",
    "issue_url": "https://github.com/owner/repo/issues/1",
    "github_token": "fake-token",
    "issue_title": "Test bug",
    "issue_body": "Something is broken",
    "issue_comments": [],
    "repo_url": "https://github.com/owner/repo",
    "repo_language": "Python",
    "relevant_files": [],
    "test_code": "",
    "test_output": "",
    "test_passed": False,
    "test_error": "",
    "fix_code": "",
    "fixed_file_path": "",
    "fix_verified": False,
    "fix_retry_count": 0,
    "pr_url": "",
    "retry_count": 0,
    "error": None,
}


# ─── decide_after_test ────────────────────────────────────────────────

class TestDecideAfterTest:
    def test_bug_confirmed_goes_to_write_fix(self):
        """Test fails as expected → proceed to write fix."""
        state = dict(BASE_STATE, test_passed=False, test_error="")
        assert decide_after_test(state) == "write_fix"

    def test_setup_error_triggers_rewrite(self):
        """Setup/syntax errors should rewrite the test."""
        state = dict(BASE_STATE, test_error="SyntaxError: bad syntax", retry_count=0)
        assert decide_after_test(state) == "rewrite_test"

    def test_setup_error_max_retries_ends(self):
        """Too many setup errors → stop."""
        state = dict(
            BASE_STATE,
            test_error="ImportError: no module",
            retry_count=MAX_RETRIES,
        )
        assert decide_after_test(state) == "end"

    def test_test_passed_ends(self):
        """Test passed means bug wasn't reproduced → end."""
        state = dict(BASE_STATE, test_passed=True, test_error="")
        assert decide_after_test(state) == "end"

    def test_test_passed_with_retries_ends(self):
        """Even with retries left, passing test = bug not reproduced = end."""
        state = dict(BASE_STATE, test_passed=True, retry_count=0)
        assert decide_after_test(state) == "end"


# ─── decide_after_verify ──────────────────────────────────────────────

class TestDecideAfterVerify:
    def test_fix_verified_opens_pr(self):
        state = dict(BASE_STATE, fix_verified=True)
        assert decide_after_verify(state) == "open_pr"

    def test_fix_failed_retries(self):
        state = dict(BASE_STATE, fix_verified=False, fix_retry_count=0)
        assert decide_after_verify(state) == "retry_fix"

    def test_fix_max_retries_ends(self):
        state = dict(
            BASE_STATE, fix_verified=False, fix_retry_count=MAX_FIX_RETRIES
        )
        assert decide_after_verify(state) == "end"


# ─── increment_retry ──────────────────────────────────────────────────

class TestIncrementRetry:
    def test_increments_count(self):
        result = increment_retry(dict(BASE_STATE, retry_count=2))
        assert result["retry_count"] == 3

    def test_starts_at_one_when_not_set(self):
        result = increment_retry(dict(BASE_STATE))
        assert result["retry_count"] == 1

    def test_resets_test_code(self):
        result = increment_retry(dict(BASE_STATE, test_code="old_code"))
        assert result["test_code"] == ""

    def test_preserves_test_error(self):
        result = increment_retry(
            dict(BASE_STATE, test_error="ImportError: x")
        )
        assert "ImportError" in result["test_error"]


# ─── increment_fix_retry ──────────────────────────────────────────────

class TestIncrementFixRetry:
    def test_increments_count(self):
        result = increment_fix_retry(dict(BASE_STATE, fix_retry_count=1))
        assert result["fix_retry_count"] == 2

    def test_starts_at_one_when_not_set(self):
        result = increment_fix_retry(dict(BASE_STATE))
        assert result["fix_retry_count"] == 1

    def test_resets_fix_code(self):
        result = increment_fix_retry(dict(BASE_STATE, fix_code="old_fix"))
        assert result["fix_code"] == ""

    def test_resets_file_path(self):
        result = increment_fix_retry(
            dict(BASE_STATE, fixed_file_path="path/to/file.py")
        )
        assert result["fixed_file_path"] == ""
