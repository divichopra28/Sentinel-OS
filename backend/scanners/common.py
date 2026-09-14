"""Shared helpers for normalizing raw scanner output into Finding objects."""
from __future__ import annotations

import hashlib
from pathlib import Path

from models.schemas import Severity


def make_finding_id(tool: str, rule_id: str, file_path: str, line_number: int) -> str:
    raw = f"{tool}:{rule_id}:{file_path}:{line_number}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def read_snippet(file_path: Path, line_number: int, context: int = 2) -> str:
    if not file_path.is_file() or line_number <= 0:
        return ""
    try:
        lines = file_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    start = max(0, line_number - 1 - context)
    end = min(len(lines), line_number + context)
    return "\n".join(lines[start:end])


def relative_path(file_path: str, repo_root: Path) -> str:
    try:
        return str(Path(file_path).resolve().relative_to(repo_root.resolve()))
    except ValueError:
        return file_path


SEMGREP_SEVERITY_MAP = {
    "ERROR": Severity.high,
    "WARNING": Severity.medium,
    "INFO": Severity.low,
}

BANDIT_SEVERITY_MAP = {
    "HIGH": Severity.high,
    "MEDIUM": Severity.medium,
    "LOW": Severity.low,
}

NPM_SEVERITY_MAP = {
    "critical": Severity.critical,
    "high": Severity.high,
    "moderate": Severity.medium,
    "low": Severity.low,
    "info": Severity.info,
}

PIP_AUDIT_SEVERITY_DEFAULT = Severity.high
