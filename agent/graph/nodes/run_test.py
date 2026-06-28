import os
import sys
import subprocess
import tempfile
import zipfile
import io
import requests
from graph.state import AgentState
from core.utils import parse_github_url
from services.publisher import publish_log

def run_test(state: AgentState) -> AgentState:
    publish_log(state["job_id"], "Running test in sandbox", "running")
    print(f"[Node 4] Setting up sandbox...")

    owner, repo, _ = parse_github_url(state["repo_url"])

    headers = {
        "Authorization": f"Bearer {state['github_token']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    print(f"[Node 4] Downloading repository...")
    zip_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/zipball/HEAD",
        headers=headers,
        allow_redirects=True
    )

    if zip_response.status_code != 200:
        return {
            **state,
            "error": f"Failed to download repo: {zip_response.status_code}"
        }

    with tempfile.TemporaryDirectory() as tmpdir:
        print(f"[Node 4] Extracting repository...")
        zip_file = zipfile.ZipFile(io.BytesIO(zip_response.content))
        zip_file.extractall(tmpdir)

        extracted_folders = os.listdir(tmpdir)
        repo_dir = os.path.join(tmpdir, extracted_folders[0])

        test_file_path = os.path.join(repo_dir, "test_bug_reproduction.py")
        with open(test_file_path, "w", encoding="utf-8") as f:
            f.write(state["test_code"])

        print(f"[Node 4] Test file written")

        python = sys.executable

        print(f"[Node 4] Installing dependencies...")
        requirements_file = os.path.join(repo_dir, "requirements.txt")
        pyproject_file = os.path.join(repo_dir, "pyproject.toml")

        if os.path.exists(requirements_file):
            subprocess.run(
                [python, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
                cwd=repo_dir,
                capture_output=True
            )
        elif os.path.exists(pyproject_file):
            subprocess.run(
                [python, "-m", "pip", "install", "-e", ".", "-q"],
                cwd=repo_dir,
                capture_output=True
            )

        subprocess.run(
            [python, "-m", "pip", "install", "pytest", "-q"],
            capture_output=True
        )

        print(f"[Node 4] Running test...")
        result = subprocess.run(
            [
                python, "-m", "pytest",
                "test_bug_reproduction.py",
                "-v",
                "--tb=short",
                "--no-header",
                "--override-ini=addopts=",
            ],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=60
        )

        test_output = result.stdout + result.stderr

        print(f"[Node 4] Test exit code: {result.returncode}")
        print(f"[Node 4] Test output:")
        print(test_output[:1000])

        # Detect what kind of failure this is
        setup_error_keywords = [
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

        test_error = ""
        if result.returncode == 1:
            publish_log(state["job_id"], "Running test in sandbox", "done", "Bug confirmed — test fails as expected")
            is_setup_error = any(kw in test_output for kw in setup_error_keywords)

            if is_setup_error:
                test_error = test_output
                print(f"[Node 4] ✗ Test has setup/syntax error — need to rewrite test")
            else:
                print(f"[Node 4] ✓ Bug confirmed — test fails with real assertion")

        elif result.returncode == 0:
            publish_log(state["job_id"], "Running test in sandbox", "error", "Test passed — bug not reproduced")
            print(f"[Node 4] ⚠ Test passed — bug not reproduced")
            test_error = "Test passed unexpectedly — the bug was not reproduced"

        else:
            test_error = test_output
            print(f"[Node 4] ✗ Could not run test — exit code {result.returncode}")
            publish_log(state["job_id"], "Running test in sandbox", "error", f"Test error — exit code {result.returncode}")

        test_passed = result.returncode == 0

    return {
        "test_output": test_output,
        "test_passed": test_passed,
        "test_error": test_error
    }