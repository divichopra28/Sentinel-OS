"""Run `npm audit` against every Node package in a repo and normalize findings."""
from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path

from models.schemas import Finding, Severity
from scanners.common import NPM_SEVERITY_MAP, make_finding_id, relative_path

logger = logging.getLogger(__name__)

IGNORED_DIRS = {"node_modules", ".git", "venv", ".venv", "dist", "build"}

# On Windows, npm is a .cmd shim; subprocess.run(["npm", ...]) raises
# FileNotFoundError because CreateProcess doesn't resolve PATHEXT the way a
# shell does. shutil.which() finds the real (.cmd) path on every platform.
NPM_EXECUTABLE = shutil.which("npm") or "npm"


def _find_package_dirs(repo_path: Path) -> list[Path]:
    dirs = []
    for pkg_json in repo_path.rglob("package.json"):
        if any(part in IGNORED_DIRS for part in pkg_json.parts):
            continue
        dirs.append(pkg_json.parent)
    return dirs


def _ensure_lockfile(pkg_dir: Path) -> bool:
    if (pkg_dir / "package-lock.json").exists():
        return True
    try:
        subprocess.run(
            [NPM_EXECUTABLE, "install", "--package-lock-only", "--ignore-scripts", "--no-audit"],
            cwd=pkg_dir,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("could not generate package-lock.json in %s: %s", pkg_dir, exc)
        return False
    return (pkg_dir / "package-lock.json").exists()


def _audit_one(pkg_dir: Path, repo_path: Path) -> list[Finding]:
    if not _ensure_lockfile(pkg_dir):
        return []
    try:
        proc = subprocess.run(
            [NPM_EXECUTABLE, "audit", "--json"],
            cwd=pkg_dir,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("npm audit unavailable or timed out in %s: %s", pkg_dir, exc)
        return []

    if not proc.stdout:
        return []
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []

    findings: list[Finding] = []
    vulnerabilities = data.get("vulnerabilities", {})
    pkg_json_path = str(pkg_dir / "package.json")
    rel_path = relative_path(pkg_json_path, repo_path)

    for name, vuln in vulnerabilities.items():
        severity_raw = vuln.get("severity", "low")
        via = vuln.get("via", [])
        cwe_id = None
        description_parts = []
        for entry in via:
            if isinstance(entry, dict):
                description_parts.append(entry.get("title", ""))
                cwes = entry.get("cwe") or []
                if cwes and not cwe_id:
                    cwe_id = cwes[0] if isinstance(cwes, list) else cwes
        description = "; ".join(p for p in description_parts if p) or f"Vulnerable dependency: {name}"

        fix_available = vuln.get("fixAvailable")
        if isinstance(fix_available, dict):
            fixed_version = fix_available.get("version")
        elif fix_available:
            fixed_version = "a newer version"
        else:
            fixed_version = None

        findings.append(
            Finding(
                id=make_finding_id("npm-audit", name, rel_path, 0),
                tool="npm-audit",
                rule_id=name,
                file_path=rel_path,
                line_number=0,
                snippet="",
                cwe_id=cwe_id,
                severity_raw=severity_raw,
                severity=NPM_SEVERITY_MAP.get(severity_raw, Severity.low),
                description=description,
                package_name=name,
                package_version=str(vuln.get("range", "")),
                fixed_version=fixed_version,
            )
        )
    return findings


def run_npm_audit(repo_path: Path) -> list[Finding]:
    findings: list[Finding] = []
    for pkg_dir in _find_package_dirs(repo_path):
        findings.extend(_audit_one(pkg_dir, repo_path))
    return findings
