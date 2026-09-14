"""Attack Simulation Agent — "Red Team Simulation Specialist".

For the highest-signal findings, generates a plausible attack chain (a graph
of attacker steps feeding React Flow directly) starting from the
vulnerability. Explicitly framed as a defensive simulation for a security
report — steps stay at "attacker exploits X to achieve Y", never literal
exploit payloads.
"""
from __future__ import annotations

import logging
import os

from models.schemas import AttackChain, AttackEdge, AttackNode, Finding, Severity
from services import scan_store
from services.llm_service import get_crewai_llm, run_crewai_task, structured_complete

logger = logging.getLogger(__name__)

ROLE = "Red Team Simulation Specialist"
GOAL = (
    "For the highest-signal findings, model a plausible attack chain — the sequence of steps an "
    "attacker would take starting from the vulnerability, including any privilege escalation path "
    "— as a graph of nodes and edges for a defensive security report."
)
BACKSTORY = (
    "A red teamer who writes purely for defensive reporting: every chain is described at the level "
    "of 'attacker exploits X to achieve Y', never as literal exploit payloads or step-by-step attack "
    "instructions. This is a defensive simulation for a security report, not something to execute."
)

MAX_CHAINS = int(os.environ.get("SENTINELOS_MAX_ATTACK_CHAINS", "8"))
SIGNAL_SEVERITY = {Severity.critical, Severity.high}


def build_agent():
    llm = get_crewai_llm()
    if llm is None:
        return None
    try:
        from crewai import Agent
    except ImportError:
        return None
    return Agent(role=ROLE, goal=GOAL, backstory=BACKSTORY, llm=llm, verbose=False, allow_delegation=False)


def _select_high_signal(findings: list[Finding]) -> list[Finding]:
    high_signal = [f for f in findings if f.severity in SIGNAL_SEVERITY]
    return (high_signal or findings)[:MAX_CHAINS]


def _heuristic(finding: Finding) -> AttackChain:
    entry = AttackNode(
        id="n1",
        label=f"Reach {finding.file_path}:{finding.line_number}" if finding.line_number else f"Reach {finding.file_path}",
        technique=f"Attacker delivers input that reaches the vulnerable code path ({finding.rule_id}).",
    )
    exploit = AttackNode(
        id="n2",
        label="Trigger the vulnerability",
        technique=f"Attacker exploits {finding.cwe_id or finding.rule_id} to violate the app's intended trust boundary.",
    )
    impact = AttackNode(
        id="n3",
        label="Achieve impact",
        technique="Attacker leverages the compromised component to escalate access, exfiltrate data, or disrupt service.",
    )
    return AttackChain(
        chain_id=f"chain-{finding.id}",
        related_finding_ids=[finding.id],
        nodes=[entry, exploit, impact],
        edges=[AttackEdge(from_="n1", to="n2"), AttackEdge(from_="n2", to="n3")],
    )


def _llm_simulate(agent, finding: Finding) -> AttackChain | None:
    system = f"You are a {ROLE}. {BACKSTORY}"
    user = (
        "Model a defensive attack-chain simulation for this finding. Respond with a JSON object with "
        "fields: chain_id, related_finding_ids (list containing this finding's id), "
        "nodes (list of {id, label, technique}, 3-6 steps), edges (list of {from, to} using the node ids). "
        "Keep every technique description at the level of 'attacker exploits X to achieve Y' — no literal "
        "exploit payloads or executable instructions.\n\n"
        f"finding_id: {finding.id}\n"
        f"tool: {finding.tool}\n"
        f"rule_id: {finding.rule_id}\n"
        f"cwe_id: {finding.cwe_id}\n"
        f"severity: {finding.severity.value}\n"
        f"file: {finding.file_path}:{finding.line_number}\n"
        f"description: {finding.description}\n"
        f"code_snippet:\n{finding.snippet}\n"
    )

    parsed = run_crewai_task(agent, user, "A JSON object matching the AttackChain schema.", AttackChain)
    if parsed is None:
        parsed = structured_complete(system, user, AttackChain)
    if parsed is not None:
        parsed.chain_id = f"chain-{finding.id}"
        parsed.related_finding_ids = [finding.id]
    return parsed


def run(scan_id: str, findings: list[Finding]) -> list[AttackChain]:
    def log(level: str, message: str) -> None:
        scan_store.publish_log(scan_id, level, message, agent="attack_simulation")

    agent = build_agent()
    selected = _select_high_signal(findings)
    log("EXEC", f"Attack Simulation Agent modeling {len(selected)} high-signal finding(s)")

    chains: list[AttackChain] = []
    for finding in selected:
        log("EXEC", f"Simulating attack chain for {finding.file_path} ({finding.rule_id})...")
        result = _llm_simulate(agent, finding)
        chain = result or _heuristic(finding)
        chains.append(chain)
        log("INFO", f"{chain.chain_id}: {len(chain.nodes)}-step chain modeled")

    log("EXEC", f"Attack Simulation Agent complete: {len(chains)} attack chain(s) generated")
    return chains
