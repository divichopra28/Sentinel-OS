"use client";

import { FileArchive, Link2, Loader2, Play, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PanelHeader from "@/components/ui/PanelHeader";
import StatCard from "@/components/ui/StatCard";
import Stepper from "@/components/ui/Stepper";
import TerminalLogPanel from "@/components/ui/TerminalLogPanel";
import { formatDuration } from "@/lib/format";
import { useScan } from "@/lib/scan-context";
import { AGENT_ORDER } from "@/lib/types";

const ACTIVE_STATUSES = new Set(["pending", "scanning", "analyzing"]);

export default function ScanPage() {
  const router = useRouter();
  const { scan, scanId, logs, connectionError, isStarting, startError, startScan } = useScan();
  const [repoUrl, setRepoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = scan ? ACTIVE_STATUSES.has(scan.status) : false;

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  function pickFile(candidate: File) {
    const name = candidate.name.toLowerCase();
    if (!name.endsWith(".zip") && !name.endsWith(".tar.gz") && !name.endsWith(".tgz")) {
      setValidationError("Unsupported archive type — use .zip or .tar.gz (.rar isn't supported).");
      return;
    }
    setValidationError(null);
    setFile(candidate);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  async function handleStart() {
    setValidationError(null);
    if (!repoUrl.trim() && !file) {
      setValidationError("Enter a repository URL or drop a source archive.");
      return;
    }
    try {
      await startScan(repoUrl.trim() ? { repoUrl: repoUrl.trim() } : { file: file! });
    } catch {
      // startError already surfaced via context
    }
  }

  const doneCount = scan ? AGENT_ORDER.filter((a) => scan.agent_statuses[a] === "done").length : 0;
  const progress = scan ? Math.round((doneCount / AGENT_ORDER.length) * 100) : 0;
  const duration = scan ? formatDuration(scan.started_at, scan.completed_at) : "00:00";

  let buttonLabel = "Start Scan";
  let buttonDisabled = isStarting;
  let onButtonClick: () => void = handleStart;
  if (scan?.status === "completed") {
    buttonLabel = "View Results →";
    onButtonClick = () => router.push("/agents");
  } else if (isActive) {
    buttonLabel = "Scanning in Progress → Next Stage";
    buttonDisabled = true;
  } else if (scan?.status === "failed") {
    buttonLabel = "Retry Scan";
  }

  return (
    <div>
      <Stepper agentStatuses={scan?.agent_statuses} />

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-panel p-5">
            <PanelHeader icon={Link2} label="Target Selection" />

            <label className="mb-1.5 block text-xs font-medium text-secondary">Repository URL</label>
            <div className="relative mb-4">
              <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                type="text"
                value={repoUrl}
                disabled={isActive}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full rounded-md border border-border bg-app py-2.5 pl-9 pr-3 text-sm text-primary placeholder:text-secondary focus:border-mint/40 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-widest text-secondary">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isActive && fileInputRef.current?.click()}
              className={`mb-1.5 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-8 text-center transition ${
                isDragging ? "border-mint bg-mint/5" : "border-border"
              } ${isActive ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tar.gz,.tgz"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <FileArchive size={22} className="mb-2 text-mint" strokeWidth={1.75} />
                  <p className="text-sm text-primary">{file.name}</p>
                </>
              ) : (
                <>
                  <UploadCloud size={22} className="mb-2 text-secondary" strokeWidth={1.75} />
                  <p className="text-sm text-primary">Drag and drop source code archives here</p>
                </>
              )}
            </div>
            <p className="mb-4 text-[11px] text-secondary">Supported formats: .zip, .tar.gz</p>

            {(validationError || startError) && (
              <p className="mb-3 text-xs text-critical">{validationError || startError}</p>
            )}

            <button
              onClick={onButtonClick}
              disabled={buttonDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-mint py-2.5 text-sm font-semibold text-app transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isActive ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2} />}
              {buttonLabel}
            </button>
          </div>

          <div className="rounded-md border border-border bg-panel p-5">
            <PanelHeader
              label="Scan Status"
              right={
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive
                        ? "animate-pulse-dot bg-running"
                        : scan?.status === "completed"
                          ? "bg-operational"
                          : scan?.status === "failed"
                            ? "bg-critical"
                            : "bg-idle"
                    }`}
                  />
                  <span className="text-xs text-secondary">
                    {scan ? scan.status[0].toUpperCase() + scan.status.slice(1) : "Idle"}
                  </span>
                </span>
              }
            />

            {scan?.status === "failed" && (
              <div className="mb-5 rounded-md border border-critical/40 bg-critical/10 px-3 py-2.5">
                <p className="text-xs font-semibold text-critical">Scan failed</p>
                <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-critical/80">
                  {scan.error ?? "Unknown error — check SYSTEM LOGS below for details."}
                </p>
              </div>
            )}

            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-widest text-secondary">
                <span>Overall Progress</span>
                <span className="font-mono text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-panel-raised">
                <div className="h-1.5 rounded-full bg-mint transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {scan && scan.findings.length > 0 && (
              <div className="mb-5 flex justify-center">
                <span className="rounded bg-critical/15 px-3 py-1 font-mono text-xs font-semibold text-critical">
                  {scan.findings.length} Vulnerabilities Found
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Duration" value={duration} />
              <StatCard label="Files Scanned" value={scan?.files_scanned ?? "—"} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <TerminalLogPanel
            title="SYSTEM LOGS"
            logs={logs}
            emptyText={scanId ? "Waiting for scanner output…" : "Start a scan to see live output here."}
            height="20rem"
          />
        </div>

        {connectionError && (
          <p className="mt-3 text-xs text-high">Live updates disconnected — showing the last known state.</p>
        )}
      </div>
    </div>
  );
}
