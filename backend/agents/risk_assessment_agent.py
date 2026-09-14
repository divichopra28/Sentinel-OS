"""Risk Assessment Agent — "Security Risk Prioritization Lead".

Scores every finding on severity, exploit likelihood, and estimated business
impact, then produces a single prioritized ranking. Uses the CVSS vector
shape as a reference framework but keeps the score practical: it combines
tool severity, the threat-analysis write-up, and whether an attack chain
exists for that finding.
"""
from __future__ import annotations

import logging
import os

from models.schemas import AttackChain, BusinessImpact, Finding, RiskScore, Severity, ThreatAnalysis
from services import scan_store
from services.llm_service import get_crewai_llm, run_crewai_task, structured_complete

logger = logging.getLogger(__name__)

ROLE = "Security Risk Prioritization Lead"
GOAL = (
    "Score every finding on severity, exploit likelihood, and estimated business impact, then "
    "produce a single prioritized ranking, using the CVSS vector shape as a reference framework "
    "while keeping the score practical."
)
BACKSTORY = (
    "A risk lead who has to defend every ranking to an engineering VP: scores must be explainable, "
    "consistent with tool severity, and adjusted up when a finding has a demonstrated attack path."
)

MAX_LLM_ITEMS = int(os.environ.get("SENTINELOS_MAX_LLM_ITEMS", "30"))

SEVERITY_BASE = {
    Severity.critical: 9.0,
    Severity.high: 7.0,
    Severity.medium: 4.5,
    Severity.low: 2.0,
    Severity.info: 0.5,
}
LIKELIHOOD_BASE = {
    Severity.critical: 8.0,
    Severity.high: 6.5,
    Severity.medium: 4.0,
    Severity.low: 2.0,
    Severity.info: 1.0,
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


def _business_impact(severity: Severity) -> BusinessImpact:
    if severity in (Severity.critical, Severity.high):
        return BusinessImpact.high
    if severity == Severity.medium:
        return BusinessImpact.medium
    return BusinessImpact.low


def _composite(severity: float, likelihood: float, business_impact: BusinessImpact, has_chain: bool) -> float:
    impact_weight = {BusinessImpact.high: 1.0, BusinessImpact.medium: 0.7, BusinessImpact.low: 0.4}[business_impact]
    score = severity * 0.5 + likelihood * 0.3 + (impact_weight * 10) * 0.2
    if has_chain:
        score = min(10.0, score + 0.5)
    return round(min(10.0, score), 2)


def _heuristic(finding: Finding, has_chain: bool) -> RiskScore:
    severity = SEVERITY_BASE.get(finding.severity, 3.0)
    likelihood = LIKELIHOOD_BASE.get(finding.severity, 3.0)
    if has_chain:
        likelihood = min(10.0, likelihood + 1.0)
    business_impact = _business_impact(finding.severity)
    composite = _composite(severity, likelihood, business_impact, has_chain)
    return RiskScore(
        finding_id=finding.id,
        severity=severity,
        likelihood=likelihood,
        business_impact=business_impact,
        composite_score=composite,
        priority_rank=0,
    )


def _llm_score(
    agent, finding: Finding, analysis: ThreatAnalysis | None, has_chain: bool
) -> RiskScore | None:
    system = f"You are a {ROLE}. {BACKSTORY}"
    user = (
        "Score this finding. Respond with a JSON object with fields: finding_id, severity (0-10), "
        "likelihood (0-10), business_impact (one of: low, medium, high), composite_score (0-10, your "
        "overall practical score), priority_rank (set to 0, it will be recomputed).\n\n"
        f"finding_id: {finding.id}\n"
        f"tool_severity: {finding.severity.value}\n"
        f"cwe_id: {finding.cwe_id}\n"
        f"description: {finding.description}\n"
        f"exploitability_explanation: {analysis.exploitability_explanation if analysis else 'n/a'}\n"
        f"impact_category: {analysis.impact_category.value if analysis else 'n/a'}\n"
        f"has_demonstrated_attack_chain: {has_chain}\n"
    )

    parsed = run_crewai_task(agent, user, "A JSON object matching the RiskScore schema.", RiskScore)
    if parsed is None:
        parsed = structured_complete(system, user, RiskScore)
    if parsed is not None:
        parsed.finding_id = finding.id
    return parsed


def run(
    scan_id: str,
    findings: list[Finding],
    threat_analyses: list[ThreatAnalysis],
    attack_chains: list[AttackChain],
) -> list[RiskScore]:
    def log(level: str, message: str) -> None:
        scan_store.publish_log(scan_id, level, message, agent="risk_assessment")

    agent = build_agent()
    log("EXEC", f"Risk Assessment Agent scoring {len(findings)} finding(s)")

    analysis_by_finding = {a.finding_id: a for a in threat_analyses}
    findings_with_chains = {fid for chain in attack_chains for fid in chain.related_finding_ids}

    scores: list[RiskScore] = []
    for index, finding in enumerate(findings):
        has_chain = finding.id in findings_with_chains
        result = (
            _llm_score(agent, finding, analysis_by_finding.get(finding.id), has_chain)
            if index < MAX_LLM_ITEMS
            else None
        )
        score = result or _heuristic(finding, has_chain)
        scores.append(score)

    scores.sort(key=lambda s: s.composite_score, reverse=True)
    for rank, score in enumerate(scores, start=1):
        score.priority_rank = rank
    log("EXEC", f"Risk Assessment Agent complete: ranked {len(scores)} finding(s)")
    return scores
