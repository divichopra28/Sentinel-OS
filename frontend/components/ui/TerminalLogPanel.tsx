"use client";

import { Copy, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatClockTime } from "@/lib/format";
import type { LogEntry, LogLevel } from "@/lib/types";

const LEVEL_CLASSES: Record<LogLevel, string> = {
  INFO: "text-secondary",
  EXEC: "text-mint",
  WARN: "text-high",
  ERROR: "text-critical",
};

const ROW_TINT: Partial<Record<LogLevel, string>> = {
  WARN: "bg-high/[0.06]",
  ERROR: "bg-critical/[0.08]",
};

interface TerminalLogPanelProps {
  title: string;
  logs: LogEntry[];
  emptyText?: string;
  height?: string;
}

export default function TerminalLogPanel({
  title,
  logs,
  emptyText = "No activity yet.",
  height = "16rem",
}: TerminalLogPanelProps) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  async function handleCopy() {
    const text = logs
      .map((entry) => `${formatClockTime(entry.timestamp)}  [${entry.level}]  ${entry.message}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — nothing sensible to fall back to here
    }
  }

  return (
    <div className="rounded-md border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-secondary">
          <Terminal size={13} strokeWidth={2} />
          <span>{`// ${title}`}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[11px] font-medium text-secondary transition hover:border-mint/40 hover:text-mint"
        >
          <Copy size={11} strokeWidth={2} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div ref={scrollRef} className="scrollbar-thin overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed" style={{ height }}>
        {logs.length === 0 ? (
          <p className="text-secondary/70">{emptyText}</p>
        ) : (
          logs.map((entry, index) => (
            <div key={index} className={`whitespace-pre-wrap px-1 ${ROW_TINT[entry.level] ?? ""}`}>
              <span className="text-secondary/60">{formatClockTime(entry.timestamp)}</span>{"  "}
              <span className={`font-semibold ${LEVEL_CLASSES[entry.level]}`}>[{entry.level}]</span>{"  "}
              <span className="text-primary/90">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
