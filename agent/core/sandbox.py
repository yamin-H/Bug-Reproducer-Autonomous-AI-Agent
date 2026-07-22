"""Shared sandbox utilities for running code in isolated temporary directories.

Used by run_test and verify_fix nodes to eliminate code duplication
when downloading repos, installing dependencies, and running tests.
"""

import io
import os
import sys
import logging
import subprocess
import tempfile
import zipfile
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def download_and_extract_repo(
    owner: str,
    repo: str,
    github_token: str,
) -> str:
    """Download a GitHub repo zipball and extract to a temp directory.

    Returns the path to the extracted repository root.
    The temp directory is NOT auto-deleted — caller must clean up.
    """
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    logger.info("Downloading repository %s/%s...", owner, repo)
    zip_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/zipball/HEAD",
        headers=headers,
        allow_redirects=True,
        timeout=120,
    )

    if zip_response.status_code != 200:
        raise RuntimeError(
            f"Failed to download repo {owner}/{repo}: "
            f"{zip_response.status_code} {zip_response.reason}"
        )

    tmpdir = tempfile.mkdtemp(prefix="bugreproducer_")
    logger.info("Extracting repository to %s...", tmpdir)
    zip_file = zipfile.ZipFile(io.BytesIO(zip_response.content))
    zip_file.extractall(tmpdir)

    extracted = os.listdir(tmpdir)
    if not extracted:
        raise RuntimeError("Empty archive — no files extracted")

    repo_dir = os.path.join(tmpdir, extracted[0])
    logger.info("Repository extracted to %s", repo_dir)
    return repo_dir


def install_dependencies(repo_dir: str) -> None:
    """Install project dependencies if a requirements file exists."""
    python = sys.executable
    requirements_file = os.path.join(repo_dir, "requirements.txt")
    pyproject_file = os.path.join(repo_dir, "pyproject.toml")

    if os.path.exists(requirements_file):
        logger.info("Installing from requirements.txt...")
        subprocess.run(
            [python, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
            cwd=repo_dir,
            capture_output=True,
            timeout=120,
        )
    elif os.path.exists(pyproject_file):
        logger.info("Installing from pyproject.toml...")
        subprocess.run(
            [python, "-m", "pip", "install", "-e", ".", "-q"],
            cwd=repo_dir,
            capture_output=True,
            timeout=120,
        )
    else:
        logger.info("No dependency file found — skipping")

    logger.info("Ensuring pytest is installed...")
    subprocess.run(
        [python, "-m", "pip", "install", "pytest", "-q"],
        capture_output=True,
        timeout=60,
    )


def run_pytest(
    repo_dir: str,
    test_filename: str = "test_bug_reproduction.py",
    timeout: int = 60,
) -> subprocess.CompletedProcess:
    """Run pytest on the given test file in the repo directory.

    Returns the CompletedProcess with stdout+stderr captured.
    """
    python = sys.executable
    logger.info("Running pytest on %s...", test_filename)
    result = subprocess.run(
        [
            python,
            "-m",
            "pytest",
            test_filename,
            "-v",
            "--tb=short",
            "--no-header",
            "--override-ini=addopts=",
        ],
        cwd=repo_dir,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    logger.info("pytest exit code: %d", result.returncode)
    return result


def write_file(repo_dir: str, relative_path: str, content: str) -> str:
    """Write content to a file under repo_dir, creating directories as needed.

    Returns the full path to the written file.
    """
    full_path = os.path.join(repo_dir, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info("Wrote %s (%d chars)", relative_path, len(content))
    return full_path


SETUP_ERROR_KEYWORDS = [
    "FileExistsError",
    "FileNotFoundError",
    "ModuleNotFoundError",
    "ImportError",
    "SyntaxError",
    "IndentationError",
    "AttributeError",
    "ERROR at setup",
    "ERROR at teardown",
    "error: unrecognized",
    "has no attribute",
    "cannot import name",
]


def is_setup_error(test_output: str) -> bool:
    """Check if test failure is a setup/syntax error vs an assertion failure."""
    return any(kw in test_output for kw in SETUP_ERROR_KEYWORDS)


def make_github_api_headers(token: str) -> dict:
    """Standard GitHub API headers used across all agent nodes."""
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
