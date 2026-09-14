"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchScan, startScanFromUrl, startScanFromZip, subscribeToScan } from "./api";
import type { LogEntry, ScanResult } from "./types";

const STORAGE_KEY = "sentinelos:lastScanId";

interface StartScanInput {
  repoUrl?: string;
  file?: File;
}

interface ScanContextValue {
  scanId: string | null;
  scan: ScanResult | null;
  logs: LogEntry[];
  connectionError: boolean;
  isStarting: boolean;
  startError: string | null;
  setScanId: (id: string) => void;
  startScan: (input: StartScanInput) => Promise<string>;
}

const ScanContext = createContext<ScanContextValue | null>(null);

/**
 * Holds the single "active scan" shared by the /scan -> /agents -> /patches
 * workflow (and the sidebar's live AgentStatusPanel) so all four only ever
 * open one SSE connection between them, and navigating the workflow doesn't
 * lose live progress.
 */
export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [scanId, setScanIdState] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pipelineFinished = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setScanIdState(stored);
    } catch {
      // localStorage unavailable (private browsing, etc.) — fine, just no persistence.
    }
  }, []);

  const setScanId = useCallback((id: string) => {
    setScanIdState(id);
    setScan(null);
    setLogs([]);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;
    pipelineFinished.current = false;
    setConnectionError(false);

    const applySnapshot = (result: ScanResult) => {
      if (cancelled) return;
      setScan(result);
      setLogs(result.logs);
    };

    fetchScan(scanId)
      .then(applySnapshot)
      .catch(() => undefined);

    const unsubscribe = subscribeToScan(scanId, {
      onSnapshot: applySnapshot,
      onLog: (entry) => {
        if (!cancelled) setLogs((prev) => [...prev, entry]);
      },
      onAgentEvent: (event) => {
        if (cancelled) return;
        setScan((prev) =>
          prev ? { ...prev, agent_statuses: { ...prev.agent_statuses, [event.agent]: event.status } } : prev
        );
        if (event.status === "done" || event.status === "error") {
          fetchScan(scanId).then(applySnapshot).catch(() => undefined);
        }
        // The pipeline's last agent finishing closes the SSE stream server-side;
        // stop listening ourselves first so the expected shutdown never surfaces
        // as a "disconnected" state.
        if (event.agent === "report" && (event.status === "done" || event.status === "error")) {
          pipelineFinished.current = true;
          unsubscribe();
        }
      },
      onError: () => {
        if (!cancelled && !pipelineFinished.current) setConnectionError(true);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [scanId]);

  const startScan = useCallback(
    async ({ repoUrl, file }: StartScanInput) => {
      setIsStarting(true);
      setStartError(null);
      try {
        const result = repoUrl ? await startScanFromUrl(repoUrl) : await startScanFromZip(file!);
        setScanId(result.scan_id);
        return result.scan_id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start scan.";
        setStartError(message);
        throw err;
      } finally {
        setIsStarting(false);
      }
    },
    [setScanId]
  );

  return (
    <ScanContext.Provider
      value={{ scanId, scan, logs, connectionError, isStarting, startError, setScanId, startScan }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within a ScanProvider");
  return ctx;
}
