"""pytest configuration: ensures the agent package is importable."""

import sys
from pathlib import Path

# Add the agent root to sys.path so imports like `core.utils` work
AGENT_ROOT = Path(__file__).resolve().parent.parent
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))
