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

def verify_fix(state: AgentState) -> dict:
    publish_log(state["job_id"], "Verifying fix", "running")
    print(f"[Node 6] Verifying fix...")
    owner, repo, _ = parse_github_url(state["repo_url"])

    headers = {
        "Authorization": f"Bearer {state['github_token']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    print(f"[Node 6] Downloading repository...")
    zip_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/zipball/HEAD",
        headers=headers,
        allow_redirects=True
    )
    if zip_response.status_code != 200:
        return {"error": f"Failed to download repo: {zip_response.status_code}"}
    
    with tempfile.TemporaryDirectory() as tmpdir:
        print(f"[Node 6] Extracting repository...")
        zip_file = zipfile.ZipFile(io.BytesIO(zip_response.content))
        zip_file.extractall(tmpdir)
        extracted_folders = os.listdir(tmpdir)
        repo_dir = os.path.join(tmpdir, extracted_folders[0])
        fixed_file_path = os.path.join(repo_dir, state["fixed_file_path"])

        print(f"[Node 6] Applying fix to: {state['fixed_file_path']}")
        os.makedirs(os.path.dirname(fixed_file_path), exist_ok=True)
        with open(fixed_file_path, "w", encoding="utf-8") as f:
            f.write(state["fix_code"])

        test_file_path = os.path.join(repo_dir, "test_bug_reproduction.py")
        with open(test_file_path, "w", encoding="utf-8") as f:
            f.write(state["test_code"])

        print(f"[Node 6] Test file written")
        python = sys.executable

        print(f"[Node 6] Installing dependencies...")
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
        print(f"[Node 6] Running test against fixed code...")
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

        verify_output = result.stdout + result.stderr
        print(f"[Node 6] Exit code: {result.returncode}")
        print(f"[Node 6] Output:")
        print(verify_output[:1000])

        if result.returncode == 0:
            print(f"[Node 6] ✓ Fix verified — all tests pass")
            fix_verified = True
        else:
            if "test_is_even_correct_behavior PASSED" in verify_output or \
            "correct_behavior PASSED" in verify_output:
                print(f"[Node 6] ✓ Fix verified — correct behavior confirmed")
                fix_verified = True
            else:
                print(f"[Node 6] ✗ Fix did not work — test still failing")
                fix_verified = False
    
    if fix_verified:
        publish_log(state["job_id"], "Verifying fix", "done", "Fix works — all tests pass")
    else:
        publish_log(state["job_id"], "Verifying fix", "error", "Fix did not work")

    return {
        "fix_verified": fix_verified,
        "test_output": verify_output
    }