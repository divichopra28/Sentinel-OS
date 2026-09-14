"""Wires the six SentinelOS agents into one sequential pipeline.

The Scanner Agent is deterministic (real Semgrep/Bandit/npm-audit/pip-audit
subprocesses, no LLM). The remaining five are CrewAI Agents backed by
OpenAI (falling back to Gemini); if no provider key is configured, or a
call fails, each agent falls back to a deterministic heuristic grounded in
the finding's own fields — so the pipeline always reaches a completed
report, even fully offline. Progress is published through services.scan_store
so the SSE route can stream it live to the Agent Status Panel.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from agents import (
    attack_simulation_agent,
    patch_generation_agent,
    report_agent,
    risk_assessment_agent,
    threat_analysis_agent,
)
from agents.scanner_agent import run_scanner_agent
from models.schemas import AgentName, AgentStatus, ScanStatus
from services import repo_service, scan_store

logger = logging.getLogger(__name__)


def _emit(scan_id: str, agent: AgentName, status: AgentStatus, payload: dict | None = None, error: str | None = None) -> None:
    from models.schemas import AgentEvent

    scan_store.publish(scan_id, AgentEvent(agent=agent, status=status, payload=payload, error=error))


def run_pipeline(scan_id: str, repo_url: Optional[str], archive_path: Optional[Path]) -> None:
    """Acquire the target repo, then run all six agents in order.

    Repo acquisition (git clone or archive extraction) lives inside this same
    try/except as the agent pipeline so that ANY failure — a bad URL, a
    private repo, an unsupported archive — reaches the frontend as a proper
    "report" "error" event instead of leaving the SSE stream hanging with no
    signal at all (the scan would otherwise look stuck at "Pending" forever).
    """
    result = scan_store.get_scan(scan_id)
    if result is None:
        logger.error("run_pipeline called for unknown scan_id=%s", scan_id)
        return

    try:
        result.status = ScanStatus.scanning
        _emit(scan_id, "scanner", "running")

        if repo_url:
            scan_store.publish_log(scan_id, "EXEC", f"Cloning {repo_url}...", agent="scanner")
            repo_path = repo_service.clone_repo(repo_url, scan_id)
            scan_store.publish_log(scan_id, "INFO", "Clone complete", agent="scanner")
        elif archive_path is not None:
            scan_store.publish_log(scan_id, "EXEC", f"Extracting {archive_path.name}...", agent="scanner")
            repo_path = repo_service.extract_archive(archive_path, scan_id)
            scan_store.publish_log(scan_id, "INFO", "Extraction complete", agent="scanner")
        else:
            raise ValueError("no repo_url or archive file provided")

        findings, files_scanned = run_scanner_agent(repo_path, scan_id)
        result.findings = findings
        result.files_scanned = files_scanned
        _emit(scan_id, "scanner", "done", payload={"count": len(findings), "files_scanned": files_scanned})

        result.status = ScanStatus.analyzing

        _emit(scan_id, "threat_analysis", "running")
        result.threat_analyses = threat_analysis_agent.run(scan_id, findings)
        _emit(scan_id, "threat_analysis", "done", payload={"count": len(result.threat_analyses)})

        _emit(scan_id, "attack_simulation", "running")
        result.attack_chains = attack_simulation_agent.run(scan_id, findings)
        _emit(scan_id, "attack_simulation", "done", payload={"count": len(result.attack_chains)})

        _emit(scan_id, "patch_generation", "running")
        result.patches = patch_generation_agent.run(scan_id, findings)
        _emit(scan_id, "patch_generation", "done", payload={"count": len(result.patches)})

        _emit(scan_id, "risk_assessment", "running")
        result.risk_scores = risk_assessment_agent.run(
            scan_id, findings, result.threat_analyses, result.attack_chains
        )
        _emit(scan_id, "risk_assessment", "done", payload={"count": len(result.risk_scores)})

        _emit(scan_id, "report", "running")
        result.executive_summary = report_agent.run(scan_id, findings, result.threat_analyses, result.risk_scores)
        _emit(scan_id, "report", "done")

        result.status = ScanStatus.completed
        result.completed_at = datetime.now(timezone.utc)
    except Exception as exc:  # noqa: BLE001 - surface to the dashboard instead of killing the worker silently
        logger.exception("scan %s failed", scan_id)
        result.status = ScanStatus.failed
        result.error = str(exc)
        result.completed_at = datetime.now(timezone.utc)
        scan_store.publish_log(scan_id, "ERROR", f"Scan failed: {exc}", agent="scanner")
        # Whichever agent was mid-flight when this broke should show as failed
        # rather than stuck "running" forever in the sidebar/stepper.
        for agent_name, status in list(result.agent_statuses.items()):
            if status == "running":
                _emit(scan_id, agent_name, "error", error=str(exc))
        # The SSE route (and the frontend) treat a "report" error as the
        # pipeline's terminal signal, so always send one even if the failure
        # happened long before the Report Agent would normally run.
        if result.agent_statuses.get("report") != "error":
            _emit(scan_id, "report", "error", error=str(exc))
    finally:
        if archive_path is not None:
            archive_path.unlink(missing_ok=True)
