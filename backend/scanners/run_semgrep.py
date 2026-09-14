"""Run Semgrep (multi-language SAST) against a repo and normalize findings."""
from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

from models.schemas import Finding, Severity
from scanners.common import SEMGREP_SEVERITY_MAP, make_finding_id, relative_path

logger = logging.getLogger(__name__)


def run_semgrep(repo_path: Path) -> list[Finding]:
    try:
        proc = subprocess.run(
            [
                "semgrep",
                "scan",
                "--config",
                "auto",
                "--json",
                "--quiet",
                "--timeout",
                "120",
                str(repo_path),
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("semgrep unavailable or timed out: %s", exc)
        return []

    if not proc.stdout:
        logger.warning("semgrep produced no output: %s", proc.stderr[:500])
        return []

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.warning("semgrep output was not valid JSON")
        return []

    findings: list[Finding] = []
    for result in data.get("results", []):
        rule_id = result.get("check_id", "unknown")
        path = result.get("path", "")
        line = int(result.get("start", {}).get("line", 0))
        extra = result.get("extra", {})
        severity_raw = extra.get("severity", "INFO")
        cwe = extra.get("metadata", {}).get("cwe")
        cwe_id = cwe[0] if isinstance(cwe, list) and cwe else (cwe if isinstance(cwe, str) else None)

        findings.append(
            Finding(
                id=make_finding_id("semgrep", rule_id, path, line),
                tool="semgrep",
                rule_id=rule_id,
                file_path=relative_path(path, repo_path),
                line_number=line,
                snippet=extra.get("lines", ""),
                cwe_id=cwe_id,
                severity_raw=severity_raw,
                severity=SEMGREP_SEVERITY_MAP.get(severity_raw, Severity.medium),
                description=extra.get("message", rule_id),
            )
        )
    return findings
