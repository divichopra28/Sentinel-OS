"""Report Agent — "Security Report Writer".

Assembles every prior agent's output into a non-technical executive summary
and a prioritized remediation roadmap. The full technical appendix (findings,
attack chains, patches, risk table) is rendered straight from the structured
data by services/pdf_service.py — this agent only writes the narrative
summary that a leadership audience actually reads.
"""
from __future__ import annotations

import logging

from models.schemas import ExecutiveSummary, Finding, RiskScore, ThreatAnalysis
from services import scan_store
from services.llm_service import get_crewai_llm, run_crewai_task, structured_complete

logger = logging.getLogger(__name__)

ROLE = "Security Report Writer"
GOAL = (
    "Assemble the scan's findings, threat analyses, attack chains, patches, and risk scores into an "
    "executive summary for leadership and a prioritized remediation roadmap."
)
BACKSTORY = (
    "A security writer who translates engineering-speak into decisions leadership can act on: no "
    "jargon in the overview, and a roadmap ordered strictly by what reduces the most risk soonest."
)

TOP_N_ROADMAP = 5


def build_agent():
    llm = get_crewai_llm()
    if llm is None:
        return None
    try:
        from crewai import Agent
    except ImportError:
        return None
    return Agent(role=ROLE, goal=GOAL, backstory=BACKSTORY, llm=llm, verbose=False, allow_delegation=False)


def _heuristic(
    findings: list[Finding], risk_scores: list[RiskScore], threat_analyses: list[ThreatAnalysis]
) -> ExecutiveSummary:
    finding_by_id = {f.id: f for f in findings}
    analysis_by_id = {a.finding_id: a for a in threat_analyses}
    ranked = sorted(risk_scores, key=lambda s: s.priority_rank)

    severity_counts: dict[str, int] = {}
    for f in findings:
        severity_counts[f.severity.value] = severity_counts.get(f.severity.value, 0) + 1
    counts_str = ", ".join(f"{count} {sev}" for sev, count in severity_counts.items()) or "no findings"

    overview = (
        f"This scan identified {len(findings)} security finding(s) across the repository ({counts_str}). "
        f"The highest-priority issues are concentrated in "
        f"{len({finding_by_id[s.finding_id].file_path for s in ranked[:TOP_N_ROADMAP] if s.finding_id in finding_by_id})} "
        "file(s), and remediating the top-ranked items below would materially reduce the application's "
        "attack surface."
    )

    key_risks = []
    for score in ranked[:TOP_N_ROADMAP]:
        finding = finding_by_id.get(score.finding_id)
        if not finding:
            continue
        analysis = analysis_by_id.get(score.finding_id)
        summary = analysis.summary if analysis else finding.description
        key_risks.append(f"[{finding.severity.value.upper()}] {summary} ({finding.file_path})")

    roadmap = [
        f"{i}. Fix {finding_by_id[s.finding_id].file_path} — {finding_by_id[s.finding_id].description} "
        f"(composite risk {s.composite_score}/10)"
        for i, s in enumerate(ranked[:TOP_N_ROADMAP], start=1)
        if s.finding_id in finding_by_id
    ]

    return ExecutiveSummary(overview=overview, key_risks=key_risks, remediation_roadmap=roadmap)


def run(
    scan_id: str,
    findings: list[Finding],
    threat_analyses: list[ThreatAnalysis],
    risk_scores: list[RiskScore],
) -> ExecutiveSummary:
    def log(level: str, message: str) -> None:
        scan_store.publish_log(scan_id, level, message, agent="report")

    log("EXEC", "Report Agent compiling executive summary and remediation roadmap...")

    agent = build_agent()
    finding_by_id = {f.id: f for f in findings}
    analysis_by_id = {a.finding_id: a for a in threat_analyses}
    ranked = sorted(risk_scores, key=lambda s: s.priority_rank)[:TOP_N_ROADMAP]

    top_findings_text = "\n".join(
        f"- {finding_by_id[s.finding_id].file_path}: {finding_by_id[s.finding_id].description} "
        f"(severity={finding_by_id[s.finding_id].severity.value}, composite_score={s.composite_score}, "
        f"summary={analysis_by_id.get(s.finding_id).summary if analysis_by_id.get(s.finding_id) else 'n/a'})"
        for s in ranked
        if s.finding_id in finding_by_id
    )

    system = f"You are a {ROLE}. {BACKSTORY}"
    user = (
        f"There are {len(findings)} total findings. Here are the top {len(ranked)} by risk:\n"
        f"{top_findings_text}\n\n"
        "Write an executive summary for non-technical leadership. Respond with a JSON object with "
        "fields: overview (2-4 sentences, no jargon), key_risks (list of short bullet strings), "
        "remediation_roadmap (list of short ordered action items, most impactful first)."
    )

    parsed = run_crewai_task(agent, user, "A JSON object matching the ExecutiveSummary schema.", ExecutiveSummary)
    if parsed is None:
        parsed = structured_complete(system, user, ExecutiveSummary)
    summary = parsed if parsed is not None else _heuristic(findings, risk_scores, threat_analyses)
    log("EXEC", "Report Agent complete: executive summary ready")
    return summary
