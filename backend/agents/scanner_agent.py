"""Scanner Agent — "Security Scanner Operator".

Deterministic tool wrapper: runs Semgrep, Bandit, npm audit, and pip-audit as
real subprocesses and normalizes their output into one de-duplicated
list[Finding]. Does not call the LLM to scan; the LLM is only used (best
effort) to cluster near-identical findings across tools when an API key is
configured.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

from models.schemas import Finding
from scanners.run_bandit import run_bandit
from scanners.run_npm_audit import run_npm_audit
from scanners.run_pip_audit import run_pip_audit
from scanners.run_semgrep import run_semgrep
from services import scan_store

logger = logging.getLogger(__name__)

SCANNERS = {
    "semgrep": run_semgrep,
    "bandit": run_bandit,
    "npm-audit": run_npm_audit,
    "pip-audit": run_pip_audit,
}

IGNORED_DIRS = {"node_modules", ".git", "venv", ".venv", "dist", "build", "__pycache__", ".next"}


def _count_scannable_files(repo_path: Path) -> int:
    return sum(
        1
        for path in repo_path.rglob("*")
        if path.is_file() and not any(part in IGNORED_DIRS for part in path.parts)
    )


def _dedup(findings: list[Finding]) -> list[Finding]:
    """Collapse findings that point at the same file/line/rule across tools."""
    seen: dict[tuple, Finding] = {}
    for finding in findings:
        key = (finding.file_path, finding.line_number, finding.cwe_id, finding.rule_id)
        if key not in seen:
            seen[key] = finding
    return list(seen.values())


def run_scanner_agent(repo_path: Path, scan_id: Optional[str] = None) -> tuple[list[Finding], int]:
    """Run all four scanners concurrently and return (normalized findings, files scanned).

    When `scan_id` is given, real progress from each subprocess-backed
    scanner is streamed to that scan's log feed (SYSTEM LOGS panel).
    """

    def log(level: str, message: str) -> None:
        if scan_id:
            scan_store.publish_log(scan_id, level, message, agent="scanner")

    files_scanned = _count_scannable_files(repo_path)
    log("INFO", f"Repository contains {files_scanned} scannable file(s)")

    all_findings: list[Finding] = []
    errors: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fn, repo_path): name for name, fn in SCANNERS.items()}
        for name in futures.values():
            log("EXEC", f"Starting {name} scan against {repo_path.name}...")

        for future in as_completed(futures):
            name = futures[future]
            try:
                findings = future.result()
                all_findings.extend(findings)
                if findings:
                    log("INFO", f"{name} completed: {len(findings)} finding(s)")
                else:
                    log("INFO", f"{name} completed: no findings")
            except Exception as exc:  # noqa: BLE001 - a single scanner failing shouldn't fail the scan
                logger.exception("scanner %s failed", name)
                errors[name] = str(exc)
                log("WARN", f"{name} failed to run: {exc}")

    deduped = _dedup(all_findings)
    log(
        "EXEC",
        f"Deduplicated {len(all_findings)} raw finding(s) from {len(SCANNERS)} tools into "
        f"{len(deduped)} unique finding(s)",
    )

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    deduped.sort(key=lambda f: severity_order.get(f.severity.value, 5))
    return deduped, files_scanned
