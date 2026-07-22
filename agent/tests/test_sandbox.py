"""Tests for sandbox utilities (isolated, no network calls)."""

from core.sandbox import (
    is_setup_error,
    make_github_api_headers,
    SETUP_ERROR_KEYWORDS,
    write_file,
)


class TestIsSetupError:
    def test_module_not_found_is_setup_error(self):
        assert is_setup_error("ModuleNotFoundError: No module named 'foo'")

    def test_syntax_error_is_setup_error(self):
        assert is_setup_error("SyntaxError: invalid syntax")

    def test_import_error_is_setup_error(self):
        assert is_setup_error("ImportError: cannot import name 'foo'")

    def test_assertion_failure_is_not_setup_error(self):
        assert not is_setup_error(
            "AssertionError: assert 1 == 2"
        )

    def test_regular_test_output_is_not_setup_error(self):
        assert not is_setup_error("tests/test_example.py .F..")

    def test_empty_string_is_not_setup_error(self):
        assert not is_setup_error("")


class TestMakeGithubApiHeaders:
    def test_returns_correct_headers(self):
        headers = make_github_api_headers("token-123")
        assert headers["Authorization"] == "Bearer token-123"
        assert headers["Accept"] == "application/vnd.github+json"
        assert headers["X-GitHub-Api-Version"] == "2022-11-28"

    def test_token_is_used_correctly(self):
        headers = make_github_api_headers("ghp_abc123")
        assert "ghp_abc123" in headers["Authorization"]


class TestWriteFile:
    def test_writes_content_to_file(self, tmp_path):
        file_path = write_file(str(tmp_path), "test.txt", "hello world")
        assert (tmp_path / "test.txt").read_text() == "hello world"

    def test_creates_intermediate_directories(self, tmp_path):
        file_path = write_file(str(tmp_path), "a/b/c/deep.txt", "deep")
        assert (tmp_path / "a/b/c/deep.txt").read_text() == "deep"

    def test_overwrites_existing_file(self, tmp_path):
        (tmp_path / "existing.txt").write_text("old")
        write_file(str(tmp_path), "existing.txt", "new")
        assert (tmp_path / "existing.txt").read_text() == "new"
