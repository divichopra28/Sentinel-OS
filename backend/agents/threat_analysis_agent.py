"""Threat Analysis Agent — "Application Security Analyst".

For each Finding, explains in plain language what the vulnerability is, why
it is exploitable in this specific code context, and its technical impact.
Prefers a real LLM call (CrewAI agent backed by OpenAI, falling back to
Gemini); if no provider key is configured, or a call fails, falls back to a
deterministic template grounded in the finding's own fields so the pipeline
never stalls waiting on an LLM.
"""
from __future__ import annotations

import logging
import os

from models.schemas import Finding, ImpactCategory, ThreatAnalysis
from services import scan_store
from services.llm_service import get_crewai_llm, run_crewai_task, structured_complete

logger = logging.getLogger(__name__)

ROLE = "Application Security Analyst"
GOAL = (
    "For each security finding, explain in plain language what the vulnerability is, "
    "why it is exploitable in this specific code context, and what the technical impact "
    "would be across confidentiality, integrity, and availability."
)
BACKSTORY = (
    "A pragmatic AppSec analyst who has triaged thousands of SAST and dependency-audit "
    "findings. Skeptical of generic CWE boilerplate — always grounds an explanation in the "
    "actual code snippet in front of them, and says plainly when a finding looks like a "
    "false positive."
)

MAX_LLM_ITEMS = int(os.environ.get("SENTINELOS_MAX_LLM_ITEMS", "30"))

IMPACT_BY_TOOL = {
    "npm-audit": ImpactCategory.multiple,
    "pip-audit": ImpactCategory.multiple,
}


def build_agent():
    llm = get_crewai_llm()
    if llm is None:
        return None
    try:
        from crewai import Agent
    except ImportError:
        return None
    return Agent(role=ROLE, goal=GOAL, backstory=BACKSTORY, llm=llm, verbose=False, allow_delegation=False)


def _heuristic(finding: Finding) -> ThreatAnalysis:
    impact = IMPACT_BY_TOOL.get(finding.tool, ImpactCategory.confidentiality)
    location = f"{finding.file_path}:{finding.line_number}" if finding.line_number else finding.file_path
    summary = f"{finding.description.strip().rstrip('.')} at {location}."
    if finding.tool in ("npm-audit", "pip-audit"):
        explanation = (
            f"The dependency `{finding.package_name}` ({finding.package_version or 'unknown version'}) "
            f"declared in {finding.file_path} has a known vulnerability ({finding.rule_id}). Any code path "
            "that exercises the vulnerable functionality inherits the exposure, and severity is driven by "
            "how reachable that functionality is from untrusted input."
        )
    else:
        explanation = (
            f"Static analysis ({finding.tool}, rule `{finding.rule_id}`) flagged this code because the pattern "
            f"at {location} matches a known-unsafe construct. Based on the snippet, an attacker who can "
            "influence the relevant input reaching this line could trigger the unsafe behavior directly."
        )
    return ThreatAnalysis(
        finding_id=finding.id,
        summary=summary,
        exploitability_explanation=explanation,
        impact_category=impact,
    )


def _llm_analyze(agent, finding: Finding) -> ThreatAnalysis | None:
    system = f"You are a {ROLE}. {BACKSTORY}"
    user = (
        "Analyze this security finding and respond with a JSON object with fields: "
        "finding_id, summary (1 sentence), exploitability_explanation (a paragraph grounded in the "
        "snippet below, not generic CWE text), impact_category (one of: confidentiality, integrity, "
        "availability, multiple).\n\n"
        f"finding_id: {finding.id}\n"
        f"tool: {finding.tool}\n"
        f"rule_id: {finding.rule_id}\n"
        f"cwe_id: {finding.cwe_id}\n"
        f"file: {finding.file_path}:{finding.line_number}\n"
        f"description: {finding.description}\n"
        f"code_snippet:\n{finding.snippet}\n"
    )

    parsed = run_crewai_task(
        agent, user, "A JSON object matching the ThreatAnalysis schema.", ThreatAnalysis
    )
    if parsed is None:
        parsed = structured_complete(system, user, ThreatAnalysis)
    if parsed is not None:
        parsed.finding_id = finding.id
    return parsed


def run(scan_id: str, findings: list[Finding]) -> list[ThreatAnalysis]:
    def log(level: str, message: str) -> None:
        scan_store.publish_log(scan_id, level, message, agent="threat_analysis")

    agent = build_agent()
    mode = "CrewAI/OpenAI" if agent is not None else "heuristic fallback (no LLM key configured)"
    log("EXEC", f"Threat Analysis Agent starting on {len(findings)} finding(s) via {mode}")

    analyses: list[ThreatAnalysis] = []
    for index, finding in enumerate(findings):
        location = f"{finding.file_path}:{finding.line_number}" if finding.line_number else finding.file_path
        log("EXEC", f"Analyzing {location} ({finding.rule_id})...")
        result = _llm_analyze(agent, finding) if index < MAX_LLM_ITEMS else None
        analysis = result or _heuristic(finding)
        analyses.append(analysis)
        log("INFO", f"{finding.id}: {analysis.impact_category.value} impact identified")

    log("EXEC", f"Threat Analysis Agent complete: {len(analyses)} analyses generated")
    return analyses
