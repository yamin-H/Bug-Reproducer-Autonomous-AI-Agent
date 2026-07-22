"""Tests for the GitHub URL parser utility."""

import pytest
from core.utils import parse_github_url


class TestParseGithubUrl:
    def test_full_issue_url(self):
        owner, repo, issue = parse_github_url(
            "https://github.com/owner/repo/issues/42"
        )
        assert owner == "owner"
        assert repo == "repo"
        assert issue == 42

    def test_repo_url_no_issue(self):
        owner, repo, issue = parse_github_url(
            "https://github.com/owner/repo"
        )
        assert owner == "owner"
        assert repo == "repo"
        assert issue is None

    def test_nested_owner(self):
        owner, repo, issue = parse_github_url(
            "https://github.com/my-org/my-repo/issues/123"
        )
        assert owner == "my-org"
        assert repo == "my-repo"
        assert issue == 123

    def test_large_issue_number(self):
        owner, repo, issue = parse_github_url(
            "https://github.com/a/b/issues/99999"
        )
        assert issue == 99999

    def test_invalid_url_raises(self):
        with pytest.raises(ValueError, match="Invalid GitHub URL"):
            parse_github_url("https://gitlab.com/owner/repo")

    def test_empty_url_raises(self):
        with pytest.raises(ValueError):
            parse_github_url("")

    def test_malformed_url_raises(self):
        with pytest.raises(ValueError):
            parse_github_url("not-a-url")
