"""Run pip-audit against every Python requirements file in a repo and normalize findings."""
from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

from models.schemas import Finding, Severity
from scanners.common import PIP_AUDIT_SEVERITY_DEFAULT, make_finding_id, relative_path

logger = logging.getLogger(__name__)

IGNORED_DIRS = {"node_modules", ".git", "venv", ".venv", "dist", "build"}


def _find_requirements_files(repo_path: Path) -> list[Path]:
    files = []
    for req in repo_path.rglob("requirements*.txt"):
        if any(part in IGNORED_DIRS for part in req.parts):
            continue
        files.append(req)
    return files


def _audit_one(req_file: Path, repo_path: Path) -> list[Finding]:
    try:
        proc = subprocess.run(
            ["pip-audit", "-r", str(req_file), "--format", "json", "--progress-spinner", "off"],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("pip-audit unavailable or timed out for %s: %s", req_file, exc)
        return []

    if not proc.stdout:
        return []
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []

    rel_path = relative_path(str(req_file), repo_path)
    findings: list[Finding] = []

    dependencies = data.get("dependencies", data if isinstance(data, list) else [])
    for dep in dependencies:
        name = dep.get("name", "unknown")
        version = dep.get("version", "")
        for vuln in dep.get("vulns", []):
            vuln_id = vuln.get("id", "unknown")
            fix_versions = vuln.get("fix_versions", [])
            findings.append(
                Finding(
                    id=make_finding_id("pip-audit", vuln_id, rel_path, 0),
                    tool="pip-audit",
                    rule_id=vuln_id,
                    file_path=rel_path,
                    line_number=0,
                    snippet="",
                    cwe_id=None,
                    severity_raw="unknown",
                    severity=PIP_AUDIT_SEVERITY_DEFAULT,
                    description=vuln.get("description", f"Vulnerable package: {name} {version}"),
                    package_name=name,
                    package_version=version,
                    fixed_version=", ".join(fix_versions) if fix_versions else None,
                )
            )
    return findings


def run_pip_audit(repo_path: Path) -> list[Finding]:
    findings: list[Finding] = []
    for req_file in _find_requirements_files(repo_path):
        findings.extend(_audit_one(req_file, repo_path))
    return findings
