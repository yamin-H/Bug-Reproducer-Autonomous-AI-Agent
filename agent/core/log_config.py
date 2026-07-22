"""Logging configuration for the agent.

Provides a consistent structured logging setup across all agent modules.
"""

import os
import sys
import logging


def configure_logging(level: str | None = None) -> None:
    """Configure structured logging with consistent format.

    Args:
        level: Log level string (DEBUG, INFO, WARNING, ERROR).
               Defaults to INFO, or DEBUG if ENVIRONMENT=development.
    """
    if level is None:
        env = os.environ.get("ENVIRONMENT", "development")
        level = "DEBUG" if env == "development" else "INFO"

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove default handlers and add our own
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
