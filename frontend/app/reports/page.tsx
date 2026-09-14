"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import PanelHeader from "@/components/ui/PanelHeader";
import { fetchScans, reportDownloadUrl } from "@/lib/api";
import { formatRelativeTime, repoDisplayName } from "@/lib/format";
import type { ScanResult } from "@/lib/types";

export default function ReportsPage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScans()
      .then(setScans)
      .catch(() => setScans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-primary">Reports</h1>
        <p className="mt-1 text-sm text-secondary">Download the full PDF security report generated for any completed scan.</p>
      </div>

      <div className="rounded-md border border-border bg-panel p-4">
        <PanelHeader icon={FileText} label="All Scans" />
        {scans.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">{loading ? "Loading…" : "No scans yet."}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-secondary">
                <th className="py-2 pr-3 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Vulnerabilities</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="py-2 pl-3" />
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.scan_id} className="border-b border-border/60">
                  <td className="py-3 pr-3 font-medium text-primary">{repoDisplayName(scan.repo_url)}</td>
                  <td className="px-3 py-3 text-xs text-secondary">{formatRelativeTime(scan.started_at)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-secondary">{scan.findings.length}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                        scan.status === "completed"
                          ? "bg-operational/15 text-operational"
                          : scan.status === "failed"
                            ? "bg-critical/15 text-critical"
                            : "bg-running/15 text-running"
                      }`}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      onClick={() => window.open(reportDownloadUrl(scan.scan_id), "_blank")}
                      disabled={scan.status !== "completed"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-secondary transition hover:border-mint/40 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={12} strokeWidth={2} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
