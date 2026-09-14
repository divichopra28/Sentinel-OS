"""Run Bandit (Python SAST) against a repo and normalize findings."""
from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

from models.schemas import Finding, Severity
from scanners.common import BANDIT_SEVERITY_MAP, make_finding_id, relative_path

logger = logging.getLogger(__name__)


def run_bandit(repo_path: Path) -> list[Finding]:
    try:
        proc = subprocess.run(
            ["bandit", "-r", str(repo_path), "-f", "json", "-q"],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("bandit unavailable or timed out: %s", exc)
        return []

    if not proc.stdout:
        logger.warning("bandit produced no output: %s", proc.stderr[:500])
        return []

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.warning("bandit output was not valid JSON")
        return []

    findings: list[Finding] = []
    for result in data.get("results", []):
        rule_id = result.get("test_id", "unknown")
        path = result.get("filename", "")
        line = int(result.get("line_number", 0))
        severity_raw = result.get("issue_severity", "LOW")
        cwe = result.get("issue_cwe", {}).get("id")

        findings.append(
            Finding(
                id=make_finding_id("bandit", rule_id, path, line),
                tool="bandit",
                rule_id=rule_id,
                file_path=relative_path(path, repo_path),
                line_number=line,
                snippet=result.get("code", ""),
                cwe_id=f"CWE-{cwe}" if cwe else None,
                severity_raw=severity_raw,
                severity=BANDIT_SEVERITY_MAP.get(severity_raw, Severity.low),
                description=result.get("issue_text", rule_id),
            )
        )
    return findings
