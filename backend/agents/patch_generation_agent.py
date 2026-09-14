"""Patch Generation Agent — "Secure Code Remediation Engineer".

For each finding, produces a minimal, correct code patch plus a short
explanation of why it works, rendered as a unified diff for the frontend's
diff viewer.
"""
from __future__ import annotations

import difflib
import logging
import os

from models.schemas import Finding, Patch
from services import scan_store
from services.llm_service import get_crewai_llm, run_crewai_task, structured_complete

logger = logging.getLogger(__name__)

ROLE = "Secure Code Remediation Engineer"
GOAL = (
    "For each finding, produce a minimal, correct code patch that fixes the vulnerability without "
    "changing unrelated behavior, plus a short explanation of why the patch works."
)
BACKSTORY = (
    "A senior engineer who reviews security patches for a living: every fix is the smallest change "
    "that actually closes the vulnerability, preserves existing behavior, and would pass code review "
    "without a rewrite."
)

MAX_LLM_ITEMS = int(os.environ.get("SENTINELOS_MAX_LLM_ITEMS", "30"))

DEPENDENCY_TOOLS = {"npm-audit", "pip-audit"}


def build_agent():
    llm = get_crewai_llm()
    if llm is None:
        return None
    try:
        from crewai import Agent
    except ImportError:
        return None
    return Agent(role=ROLE, goal=GOAL, backstory=BACKSTORY, llm=llm, verbose=False, allow_delegation=False)


def _make_diff(file_path: str, original: str, patched: str) -> str:
    diff = difflib.unified_diff(
        original.splitlines(keepends=True),
        patched.splitlines(keepends=True),
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
    )
    return "".join(diff)


def _dependency_line(tool: str, package: str, version: str) -> str:
    # npm's package.json pins versions as JSON string values; pip's
    # requirements.txt uses `pkg==version`. `version` itself may already be a
    # range operator (e.g. npm audit's "<=4.17.23"), so this never appends a
    # second one on top.
    if tool == "npm-audit":
        return f'"{package}": "{version}"'
    return f"{package}=={version}"


def _heuristic(finding: Finding) -> Patch:
    if finding.tool in DEPENDENCY_TOOLS:
        original = finding.package_version or "unpinned"
        patched = finding.fixed_version or "latest patched version"
        explanation = (
            f"Upgrade `{finding.package_name}` from {original} to {patched} to pull in the fix for "
            f"{finding.rule_id}. No application code changes are required."
        )
        original_line = _dependency_line(finding.tool, finding.package_name or "", original)
        patched_line = _dependency_line(finding.tool, finding.package_name or "", patched)
        diff = (
            f"--- a/{finding.file_path}\n+++ b/{finding.file_path}\n"
            f"-{original_line}\n+{patched_line}\n"
        )
        return Patch(
            finding_id=finding.id,
            original_snippet=original_line,
            patched_snippet=patched_line,
            diff=diff,
            explanation=explanation,
        )

    original_snippet = finding.snippet or ""
    patched_snippet = original_snippet
    explanation = (
        f"Automated patch generation could not confirm a safe fix for `{finding.rule_id}` "
        f"({finding.cwe_id or 'no CWE'}) without an LLM available. Manually review "
        f"{finding.file_path}:{finding.line_number} against the finding description: {finding.description}"
    )
    return Patch(
        finding_id=finding.id,
        original_snippet=original_snippet,
        patched_snippet=patched_snippet,
        diff=_make_diff(finding.file_path, original_snippet, patched_snippet),
        explanation=explanation,
    )


def _llm_patch(agent, finding: Finding) -> Patch | None:
    system = f"You are a {ROLE}. {BACKSTORY}"
    user = (
        "Produce a minimal secure patch for this finding. Respond with a JSON object with fields: "
        "finding_id, original_snippet (the vulnerable code as given), patched_snippet (the fixed code, "
        "same surrounding style), diff (a unified diff string original->patched), explanation (why the "
        "patch works, 1-3 sentences). Do not change unrelated behavior.\n\n"
        f"finding_id: {finding.id}\n"
        f"tool: {finding.tool}\n"
        f"rule_id: {finding.rule_id}\n"
        f"cwe_id: {finding.cwe_id}\n"
        f"file: {finding.file_path}:{finding.line_number}\n"
        f"description: {finding.description}\n"
        f"code_snippet:\n{finding.snippet}\n"
    )

    parsed = run_crewai_task(agent, user, "A JSON object matching the Patch schema.", Patch)
    if parsed is None:
        parsed = structured_complete(system, user, Patch)
    if parsed is not None:
        parsed.finding_id = finding.id
        if not parsed.diff:
            parsed.diff = _make_diff(finding.file_path, parsed.original_snippet, parsed.patched_snippet)
    return parsed


def run(scan_id: str, findings: list[Finding]) -> list[Patch]:
    def log(level: str, message: str) -> None:
        scan_store.publish_log(scan_id, level, message, agent="patch_generation")

    agent = build_agent()
    log("EXEC", f"Patch Generation Agent starting on {len(findings)} finding(s)")

    patches: list[Patch] = []
    for index, finding in enumerate(findings):
        log("EXEC", f"Generating patch for {finding.file_path} ({finding.rule_id})...")
        result = _llm_patch(agent, finding) if index < MAX_LLM_ITEMS else None
        patch = result or _heuristic(finding)
        patches.append(patch)
        log("INFO", f"{finding.id}: patch drafted ({len(patch.diff.splitlines())} diff line(s))")

    log("EXEC", f"Patch Generation Agent complete: {len(patches)} patch(es) generated")
    return patches
