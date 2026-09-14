export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type ImpactCategory = "confidentiality" | "integrity" | "availability" | "multiple";
export type BusinessImpact = "low" | "medium" | "high";

export type AgentName =
  | "scanner"
  | "threat_analysis"
  | "attack_simulation"
  | "patch_generation"
  | "risk_assessment"
  | "report";

export type AgentStatus = "idle" | "running" | "done" | "error";
export type ScanStatusValue = "pending" | "scanning" | "analyzing" | "completed" | "failed";

export interface Finding {
  id: string;
  tool: "semgrep" | "bandit" | "npm-audit" | "pip-audit";
  rule_id: string;
  file_path: string;
  line_number: number;
  snippet: string;
  cwe_id: string | null;
  severity_raw: string;
  severity: Severity;
  description: string;
  package_name: string | null;
  package_version: string | null;
  fixed_version: string | null;
}

export interface ThreatAnalysis {
  finding_id: string;
  summary: string;
  exploitability_explanation: string;
  impact_category: ImpactCategory;
}

export interface AttackNode {
  id: string;
  label: string;
  technique: string;
}

export interface AttackEdge {
  from: string;
  to: string;
}

export interface AttackChain {
  chain_id: string;
  related_finding_ids: string[];
  nodes: AttackNode[];
  edges: AttackEdge[];
}

export interface Patch {
  finding_id: string;
  original_snippet: string;
  patched_snippet: string;
  diff: string;
  explanation: string;
}

export interface RiskScore {
  finding_id: string;
  severity: number;
  likelihood: number;
  business_impact: BusinessImpact;
  composite_score: number;
  priority_rank: number;
}

export interface ExecutiveSummary {
  overview: string;
  key_risks: string[];
  remediation_roadmap: string[];
}

export interface ScanResult {
  scan_id: string;
  repo_url: string | null;
  status: ScanStatusValue;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  findings: Finding[];
  threat_analyses: ThreatAnalysis[];
  attack_chains: AttackChain[];
  patches: Patch[];
  risk_scores: RiskScore[];
  executive_summary: ExecutiveSummary | null;
  logs: LogEntry[];
  files_scanned: number | null;
  agent_statuses: Record<AgentName, AgentStatus>;
}

export interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  payload?: Record<string, unknown> | null;
  error?: string | null;
}

export type LogLevel = "INFO" | "EXEC" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  agent?: AgentName | null;
}

export interface ScanCreatedResponse {
  scan_id: string;
}

export const AGENT_LABELS: Record<AgentName, string> = {
  scanner: "Scanner Agent",
  threat_analysis: "Threat Analysis Agent",
  attack_simulation: "Attack Simulation Agent",
  patch_generation: "Patch Generation Agent",
  risk_assessment: "Risk Assessment Agent",
  report: "Report Agent",
};

export const AGENT_ORDER: AgentName[] = [
  "scanner",
  "threat_analysis",
  "attack_simulation",
  "patch_generation",
  "risk_assessment",
  "report",
];

// The workflow Stepper (Scan -> Threat Analysis -> Attack Simulation ->
// Patch Generation) surfaces 4 of the 6 agents; Risk Assessment and Report
// still run and feed stat cards/PDF export, they just don't get their own
// stepper node.
export const STEPPER_STEPS: { agent: AgentName; label: string }[] = [
  { agent: "scanner", label: "Scan" },
  { agent: "threat_analysis", label: "Threat Analysis" },
  { agent: "attack_simulation", label: "Attack Simulation" },
  { agent: "patch_generation", label: "Patch Generation" },
];
