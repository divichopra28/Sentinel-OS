import type { AgentEvent, LogEntry, ScanCreatedResponse, ScanResult } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // ignore body parse errors, fall back to statusText
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function startScanFromUrl(repoUrl: string): Promise<ScanCreatedResponse> {
  const form = new FormData();
  form.append("repo_url", repoUrl);
  const response = await fetch(`${API_BASE_URL}/api/scan`, { method: "POST", body: form });
  return handleJsonResponse<ScanCreatedResponse>(response);
}

export async function startScanFromZip(file: File): Promise<ScanCreatedResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/scan`, { method: "POST", body: form });
  return handleJsonResponse<ScanCreatedResponse>(response);
}

export async function fetchScan(scanId: string): Promise<ScanResult> {
  const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}`, { cache: "no-store" });
  return handleJsonResponse<ScanResult>(response);
}

export async function fetchScans(): Promise<ScanResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/scan`, { cache: "no-store" });
  return handleJsonResponse<ScanResult[]>(response);
}

export function reportDownloadUrl(scanId: string): string {
  return `${API_BASE_URL}/api/scan/${scanId}/report`;
}

export interface ScanStreamHandlers {
  onSnapshot?: (result: ScanResult) => void;
  onAgentEvent?: (event: AgentEvent) => void;
  onLog?: (entry: LogEntry) => void;
  onError?: (error: Event) => void;
}

/**
 * Subscribes to /api/scan/{scanId}/stream via SSE. Returns an unsubscribe function.
 */
export function subscribeToScan(scanId: string, handlers: ScanStreamHandlers): () => void {
  const source = new EventSource(`${API_BASE_URL}/api/scan/${scanId}/stream`);

  source.addEventListener("snapshot", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ScanResult;
    handlers.onSnapshot?.(data);
  });

  source.addEventListener("agent", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as AgentEvent;
    handlers.onAgentEvent?.(data);
  });

  source.addEventListener("log", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as LogEntry;
    handlers.onLog?.(data);
  });

  source.onerror = (event) => {
    handlers.onError?.(event);
  };

  return () => source.close();
}
