"""Pydantic data contracts shared by every scanner, agent, and API route.

Every SSE event and API response serializes one of these models. Downstream
agents consume the previous agent's structured output, never free text.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class ImpactCategory(str, Enum):
    confidentiality = "confidentiality"
    integrity = "integrity"
    availability = "availability"
    multiple = "multiple"


class BusinessImpact(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Finding(BaseModel):
    id: str
    tool: Literal["semgrep", "bandit", "npm-audit", "pip-audit"]
    rule_id: str
    file_path: str
    line_number: int = 0
    snippet: str = ""
    cwe_id: Optional[str] = None
    severity_raw: str
    severity: Severity
    description: str
    package_name: Optional[str] = None
    package_version: Optional[str] = None
    fixed_version: Optional[str] = None


class ThreatAnalysis(BaseModel):
    finding_id: str
    summary: str
    exploitability_explanation: str
    impact_category: ImpactCategory


class AttackNode(BaseModel):
    id: str
    label: str
    technique: str


class AttackEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class AttackChain(BaseModel):
    chain_id: str
    related_finding_ids: list[str]
    nodes: list[AttackNode]
    edges: list[AttackEdge]


class Patch(BaseModel):
    finding_id: str
    original_snippet: str
    patched_snippet: str
    diff: str
    explanation: str


class RiskScore(BaseModel):
    finding_id: str
    severity: float = Field(ge=0, le=10)
    likelihood: float = Field(ge=0, le=10)
    business_impact: BusinessImpact
    composite_score: float = Field(ge=0, le=10)
    priority_rank: int


AgentName = Literal[
    "scanner",
    "threat_analysis",
    "attack_simulation",
    "patch_generation",
    "risk_assessment",
    "report",
]

AgentStatus = Literal["idle", "running", "done", "error"]


class AgentEvent(BaseModel):
    agent: AgentName
    status: AgentStatus
    payload: Optional[dict] = None
    error: Optional[str] = None


LogLevel = Literal["INFO", "EXEC", "WARN", "ERROR"]


class LogEntry(BaseModel):
    """One line of real system/agent activity, streamed to the terminal-style
    log panels. Emitted by the scanner subprocesses and by each LLM agent as
    it processes findings — never synthesized for display purposes only."""

    timestamp: datetime
    level: LogLevel
    message: str
    agent: Optional[AgentName] = None


class ScanStatus(str, Enum):
    pending = "pending"
    scanning = "scanning"
    analyzing = "analyzing"
    completed = "completed"
    failed = "failed"


class ExecutiveSummary(BaseModel):
    overview: str
    key_risks: list[str]
    remediation_roadmap: list[str]


class ScanResult(BaseModel):
    scan_id: str
    repo_url: Optional[str] = None
    status: ScanStatus = ScanStatus.pending
    started_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    findings: list[Finding] = []
    threat_analyses: list[ThreatAnalysis] = []
    attack_chains: list[AttackChain] = []
    patches: list[Patch] = []
    risk_scores: list[RiskScore] = []
    executive_summary: Optional[ExecutiveSummary] = None
    logs: list[LogEntry] = []
    files_scanned: Optional[int] = None

    agent_statuses: dict[str, AgentStatus] = {
        "scanner": "idle",
        "threat_analysis": "idle",
        "attack_simulation": "idle",
        "patch_generation": "idle",
        "risk_assessment": "idle",
        "report": "idle",
    }


class ScanRequest(BaseModel):
    repo_url: Optional[str] = None


class ScanCreatedResponse(BaseModel):
    scan_id: str
