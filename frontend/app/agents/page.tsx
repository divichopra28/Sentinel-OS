"use client";

import { ArrowRight, Filter, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ExpandableVulnRow from "@/components/ExpandableVulnRow";
import PanelHeader from "@/components/ui/PanelHeader";
import StatCard from "@/components/ui/StatCard";
import Stepper from "@/components/ui/Stepper";
import TerminalLogPanel from "@/components/ui/TerminalLogPanel";
import { useScan } from "@/lib/scan-context";
import type { Severity } from "@/lib/types";

const SEVERITY_FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low", "info"];

export default function AgentsPage() {
  const router = useRouter();
  const { scan } = useScan();
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const findings = scan?.findings ?? [];
  const analysisById = useMemo(
    () => new Map((scan?.threat_analyses ?? []).map((a) => [a.finding_id, a])),
    [scan]
  );
  const riskById = useMemo(() => new Map((scan?.risk_scores ?? []).map((r) => [r.finding_id, r])), [scan]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        f.rule_id.toLowerCase().includes(q) ||
        f.file_path.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.cwe_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [findings, query, severityFilter]);

  const agentStatus = scan?.agent_statuses.threat_analysis ?? "idle";
  const agentLogs = useMemo(() => (scan?.logs ?? []).filter((l) => l.agent === "threat_analysis"), [scan]);
  const patternsChecked = agentLogs.filter((l) => l.level === "EXEC" && l.message.startsWith("Analyzing")).length;
  const threatsFound = agentLogs.filter((l) => l.level === "INFO" && l.message.includes("impact identified")).length;

  return (
    <div>
      <Stepper agentStatuses={scan?.agent_statuses} />

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-primary">Vulnerability Feed</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter vectors..."
                    className="w-56 rounded-md border border-border bg-panel py-2 pl-9 pr-3 text-xs text-primary placeholder:text-secondary focus:border-mint/40 focus:outline-none"
                  />
                </div>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as Severity | "all")}
                  className="rounded-md border border-border bg-panel px-2.5 py-2 text-xs text-primary focus:border-mint/40 focus:outline-none"
                >
                  {SEVERITY_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All Severities" : s.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-secondary transition hover:border-mint/40 hover:text-primary">
                  <Filter size={13} strokeWidth={2} />
                  Filter
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-panel">
              {findings.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-secondary">
                  {scan ? "Waiting on the Scanner Agent…" : "Start a scan to see findings here."}
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-secondary">
                      <th className="py-2.5 pl-4 pr-3 font-medium">ID</th>
                      <th className="px-3 py-2.5 font-medium">Severity</th>
                      <th className="px-3 py-2.5 font-medium">File:Line</th>
                      <th className="px-3 py-2.5 font-medium">CWE Type</th>
                      <th className="px-3 py-2.5 font-medium">Exploitability</th>
                      <th className="py-2.5 pl-3 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((finding) => (
                      <ExpandableVulnRow
                        key={finding.id}
                        finding={finding}
                        analysis={analysisById.get(finding.id)}
                        riskScore={riskById.get(finding.id)}
                        isOpen={openId === finding.id}
                        onToggle={() => setOpenId(openId === finding.id ? null : finding.id)}
                        onDismiss={(id) => setDismissed((prev) => new Set(prev).add(id))}
                        dismissed={dismissed.has(finding.id)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => router.push("/patches")}
                className="flex items-center gap-2 rounded-md bg-mint px-4 py-2.5 text-sm font-semibold text-app transition hover:bg-mint/90"
              >
                Run Attack Simulation
                <ArrowRight size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-panel p-4">
              <PanelHeader icon={Users} label="Active Agent" />
              <p className="mb-1 text-sm font-semibold text-primary">Threat Analysis Agent</p>
              <span
                className={`inline-flex items-center gap-2 text-xs ${
                  agentStatus === "running" ? "text-running" : agentStatus === "done" ? "text-operational" : "text-secondary"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agentStatus === "running" ? "animate-pulse-dot bg-running" : agentStatus === "done" ? "bg-operational" : "bg-idle"
                  }`}
                />
                {agentStatus === "running" ? "Analyzing..." : agentStatus === "done" ? "Complete" : agentStatus === "error" ? "Error" : "Idle"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Patterns Checked" value={patternsChecked} />
              <StatCard label="Threats Found" value={threatsFound} color="red" />
            </div>

            <TerminalLogPanel title="AGENT ACTIVITY LOG" logs={agentLogs} height="20rem" />
          </div>
        </div>
      </div>
    </div>
  );
}
