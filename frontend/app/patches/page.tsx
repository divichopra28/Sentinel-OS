"use client";

import { Copy, Download, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import SplitDiffViewer from "@/components/SplitDiffViewer";
import Stepper from "@/components/ui/Stepper";
import { reportDownloadUrl } from "@/lib/api";
import { repoDisplayName } from "@/lib/format";
import { useScan } from "@/lib/scan-context";

const IMPACT_COLOR: Record<string, string> = {
  high: "text-critical",
  medium: "text-high",
  low: "text-mint",
};

function PatchesPageInner() {
  const searchParams = useSearchParams();
  const { scan, scanId } = useScan();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const findings = scan?.findings ?? [];
  const patches = scan?.patches ?? [];
  const riskScores = scan?.risk_scores ?? [];
  const findingById = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  const patchByFinding = useMemo(() => new Map(patches.map((p) => [p.finding_id, p])), [patches]);

  useEffect(() => {
    if (selectedId) return;
    const requested = searchParams.get("finding");
    if (requested && patchByFinding.has(requested)) {
      setSelectedId(requested);
      return;
    }
    const ranked = [...riskScores].sort((a, b) => a.priority_rank - b.priority_rank);
    const top = ranked.find((r) => patchByFinding.has(r.finding_id));
    if (top) setSelectedId(top.finding_id);
    else if (patches[0]) setSelectedId(patches[0].finding_id);
  }, [searchParams, patchByFinding, riskScores, patches, selectedId]);

  const selectedPatch = selectedId ? patchByFinding.get(selectedId) : undefined;
  const selectedFinding = selectedId ? findingById.get(selectedId) : undefined;

  const agentStatus = scan?.agent_statuses.patch_generation ?? "idle";
  const topRisk = [...riskScores].sort((a, b) => a.priority_rank - b.priority_rank)[0];
  const remaining = Math.max(0, findings.length - patches.length);

  async function handleCopyPatch() {
    if (!selectedPatch) return;
    try {
      await navigator.clipboard.writeText(selectedPatch.diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div>
      <Stepper agentStatuses={scan?.agent_statuses} />

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 rounded-md border border-border bg-panel p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-mint/10 text-mint">
                <Wrench size={16} strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-primary">Patch Generation Agent</span>
            </div>
            <span
              className={`flex items-center gap-2 text-xs ${
                agentStatus === "running" ? "text-running" : agentStatus === "done" ? "text-operational" : "text-secondary"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  agentStatus === "running" ? "animate-pulse-dot bg-running" : agentStatus === "done" ? "bg-operational" : "bg-idle"
                }`}
              />
              Status: {agentStatus === "done" ? "Complete" : agentStatus === "running" ? "In Progress" : agentStatus === "error" ? "Error" : "Idle"}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-secondary">
            {selectedPatch
              ? selectedPatch.explanation
              : "No patch selected yet — patches will appear here once the Patch Generation Agent has run."}
          </p>
        </div>

        {selectedPatch && selectedFinding ? (
          <div className="mb-6">
            {patches.length > 1 && (
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs font-medium text-secondary">Finding:</label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-primary focus:border-mint/40 focus:outline-none"
                >
                  {patches.map((p) => {
                    const f = findingById.get(p.finding_id);
                    return (
                      <option key={p.finding_id} value={p.finding_id}>
                        {f ? `${f.file_path}:${f.line_number || ""} — ${f.rule_id}` : p.finding_id}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <SplitDiffViewer
              patch={selectedPatch}
              fileLabel={`${selectedFinding.file_path}${selectedFinding.line_number ? `:${selectedFinding.line_number}` : ""}`}
            />
          </div>
        ) : (
          <div className="mb-6 rounded-md border border-border bg-panel p-10 text-center text-sm text-secondary">
            {scan ? "Waiting on the Patch Generation Agent…" : "Start a scan to see generated patches here."}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-panel p-4">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-secondary">Overall Risk</p>
              <p className={`font-mono text-lg font-semibold ${topRisk ? IMPACT_COLOR[topRisk.business_impact] : "text-secondary"}`}>
                {topRisk ? topRisk.business_impact.toUpperCase() : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-secondary">Vulnerabilities</p>
              <p className="font-mono text-lg font-semibold text-primary">{findings.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-secondary">Patched</p>
              <p className="font-mono text-lg font-semibold text-mint">{patches.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-secondary">Remaining</p>
              <p className="font-mono text-lg font-semibold text-high">{remaining}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyPatch}
              disabled={!selectedPatch}
              className="flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-secondary transition hover:border-mint/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={14} strokeWidth={2} />
              {copied ? "Copied" : "Copy Patch"}
            </button>
            <button
              onClick={() => scanId && window.open(reportDownloadUrl(scanId), "_blank")}
              disabled={scan?.status !== "completed"}
              className="flex items-center gap-2 rounded-md bg-mint px-3.5 py-2 text-xs font-semibold text-app transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} strokeWidth={2} />
              Download Report
            </button>
          </div>
        </div>
        {scan && <p className="mt-3 text-[11px] text-secondary">{repoDisplayName(scan.repo_url)}</p>}
      </div>
    </div>
  );
}

export default function PatchesPage() {
  return (
    <Suspense fallback={<div className="px-6 py-6 text-sm text-secondary">Loading…</div>}>
      <PatchesPageInner />
    </Suspense>
  );
}
