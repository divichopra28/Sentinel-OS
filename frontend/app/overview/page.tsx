"use client";

import { AlertTriangle, Bug, ChevronRight, Download, Gauge, Play, ShieldCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import HorizontalBarStat from "@/components/ui/HorizontalBarStat";
import PanelHeader from "@/components/ui/PanelHeader";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import { API_BASE_URL, fetchScans, reportDownloadUrl } from "@/lib/api";
import { formatRelativeTime, repoDisplayName } from "@/lib/format";
import { useScan } from "@/lib/scan-context";
import { AGENT_LABELS, AGENT_ORDER, type ScanResult, type Severity } from "@/lib/types";

export default function OverviewPage() {
  const router = useRouter();
  const { setScanId } = useScan();
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemOnline, setSystemOnline] = useState(false);

  useEffect(() => {
    fetchScans()
      .then(setScans)
      .catch(() => setScans([]))
      .finally(() => setLoading(false));

    fetch(`${API_BASE_URL}/health`)
      .then((res) => setSystemOnline(res.ok))
      .catch(() => setSystemOnline(false));
  }, []);

  const stats = useMemo(() => {
    const totalVulns = scans.reduce((sum, s) => sum + s.findings.length, 0);
    const totalPatches = scans.reduce((sum, s) => sum + s.patches.length, 0);
    const severityCounts: Partial<Record<Severity, number>> = {};
    for (const scan of scans) {
      for (const finding of scan.findings) {
        severityCounts[finding.severity] = (severityCounts[finding.severity] ?? 0) + 1;
      }
    }
    const latestCompleted = scans.find((s) => s.status === "completed" && s.risk_scores.length > 0);
    const topScore = latestCompleted
      ? Math.max(...latestCompleted.risk_scores.map((r) => r.composite_score))
      : 0;
    const riskScore = Math.round(topScore * 10);

    return { totalVulns, totalPatches, severityCounts, riskScore, latestCompleted };
  }, [scans]);

  function goToScan(scan: ScanResult) {
    setScanId(scan.scan_id);
    router.push(scan.status === "completed" ? "/agents" : "/scan");
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary">Environment Overview</h1>
          <p className="mt-1 text-sm text-secondary">
            System status and recent activity across all registered repositories.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => stats.latestCompleted && window.open(reportDownloadUrl(stats.latestCompleted.scan_id), "_blank")}
            disabled={!stats.latestCompleted}
            className="flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-secondary transition hover:border-mint/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} strokeWidth={2} />
            Export Report
          </button>
          <button
            onClick={() => router.push("/scan")}
            className="flex items-center gap-2 rounded-md bg-mint px-3.5 py-2 text-xs font-semibold text-app transition hover:bg-mint/90"
          >
            <Play size={14} strokeWidth={2} />
            Run Global Scan
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Scans" value={loading ? "—" : scans.length} icon={Gauge} />
        <StatCard label="Vulnerabilities" value={loading ? "—" : stats.totalVulns} icon={Bug} color="red" />
        <StatCard label="Patches Applied" value={loading ? "—" : stats.totalPatches} icon={Wrench} color="mint" />
        <StatCard label="Risk Score" value={loading ? "—" : stats.riskScore} suffix="/100" icon={AlertTriangle} color="orange" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-border bg-panel p-4">
          <PanelHeader label="Recent Activity" />
          {scans.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary">
              {loading ? "Loading…" : "No scans yet — run your first scan to see activity here."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-secondary">
                  <th className="py-2 pr-3 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Vulns</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr
                    key={scan.scan_id}
                    onClick={() => goToScan(scan)}
                    className="cursor-pointer border-b border-border/60 transition hover:bg-panel-raised"
                  >
                    <td className="py-3 pr-3 font-medium text-mint">{repoDisplayName(scan.repo_url)}</td>
                    <td className="px-3 py-3 text-xs text-secondary">{formatRelativeTime(scan.started_at)}</td>
                    <td className={`px-3 py-3 font-mono text-xs ${scan.findings.length > 0 ? "text-critical" : "text-secondary"}`}>
                      {scan.findings.length}
                    </td>
                    <td className="px-3 py-3">
                      {scan.status === "completed" ? (
                        <span className="inline-flex items-center rounded bg-operational/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-operational">
                          Complete
                        </span>
                      ) : scan.status === "failed" ? (
                        <span className="inline-flex items-center rounded bg-critical/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-critical">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-running/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-running">
                          {scan.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <ChevronRight size={15} className="inline text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-border bg-panel p-4">
            <PanelHeader label="Vulnerability Breakdown" />
            <HorizontalBarStat counts={stats.severityCounts} />
          </div>

          <div className="rounded-md border border-border bg-panel p-4">
            <PanelHeader
              icon={ShieldCheck}
              label="Agent Health"
              right={
                systemOnline && (
                  <span className="rounded bg-operational/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-operational">
                    All Online
                  </span>
                )
              }
            />
            <ul className="space-y-2.5">
              {AGENT_ORDER.map((agent) => (
                <li key={agent} className="flex items-center justify-between">
                  <span className="text-xs text-primary/90">{AGENT_LABELS[agent]}</span>
                  <StatusDot status={systemOnline ? "operational" : "idle"} label={systemOnline ? "Operational" : "Unreachable"} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
