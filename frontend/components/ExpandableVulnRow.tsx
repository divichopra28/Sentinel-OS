"use client";

import { AlertTriangle, ChevronDown, ClipboardPlus, Send, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import CodeBlock from "@/components/ui/CodeBlock";
import SeverityBadge from "@/components/ui/SeverityBadge";
import { SEVERITY_TEXT_CLASSES } from "@/lib/severity";
import type { Finding, RiskScore, ThreatAnalysis } from "@/lib/types";

/** Renders inline `code`-style spans for any backtick-quoted text in agent prose. */
function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-panel-raised px-1 py-0.5 font-mono text-[12px] text-mint">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface ExpandableVulnRowProps {
  finding: Finding;
  analysis?: ThreatAnalysis;
  riskScore?: RiskScore;
  isOpen: boolean;
  onToggle: () => void;
  onDismiss: (findingId: string) => void;
  dismissed?: boolean;
}

export default function ExpandableVulnRow({
  finding,
  analysis,
  riskScore,
  isOpen,
  onToggle,
  onDismiss,
  dismissed = false,
}: ExpandableVulnRowProps) {
  const router = useRouter();
  const [taskCopied, setTaskCopied] = useState(false);

  const exploitability = riskScore ? riskScore.likelihood.toFixed(1) : "—";
  const location = finding.line_number ? `${finding.file_path}:${finding.line_number}` : finding.file_path;

  async function handleCreateDevTask() {
    const task = [
      `Title: Fix ${finding.rule_id} in ${location}`,
      `Severity: ${finding.severity.toUpperCase()}`,
      finding.cwe_id ? `CWE: ${finding.cwe_id}` : null,
      `Location: ${location}`,
      `Description: ${finding.description}`,
      analysis ? `Analysis: ${analysis.summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(task);
      setTaskCopied(true);
      setTimeout(() => setTaskCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing sensible to fall back to
    }
  }

  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-border transition hover:bg-panel-raised ${dismissed ? "opacity-40" : ""}`}
      >
        <td className="py-3 pl-4 pr-3 font-mono text-xs text-secondary">{finding.id.slice(0, 8)}</td>
        <td className="px-3 py-3">
          <SeverityBadge severity={finding.severity} />
        </td>
        <td className="px-3 py-3 font-mono text-xs text-primary/90">{location}</td>
        <td className="px-3 py-3 text-xs text-secondary">{finding.cwe_id ?? "—"}</td>
        <td className={`px-3 py-3 font-mono text-xs font-semibold ${SEVERITY_TEXT_CLASSES[finding.severity]}`}>
          {exploitability}
        </td>
        <td className="py-3 pl-3 pr-4 text-right">
          <ChevronDown size={16} className={`inline text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-border bg-panel-raised">
          <td colSpan={6} className="px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-secondary">
              <AlertTriangle size={13} strokeWidth={2} />
              <span>Agent Breakdown</span>
            </div>

            {analysis ? (
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-primary/90">
                {renderInlineCode(analysis.exploitability_explanation)}
              </p>
            ) : (
              <p className="mb-4 text-sm italic text-secondary">Threat analysis pending…</p>
            )}

            {finding.snippet && (
              <div className="mb-4 max-w-3xl">
                <CodeBlock
                  code={finding.snippet}
                  startLine={Math.max(1, finding.line_number - 2)}
                  vulnerableLine={finding.line_number || null}
                />
              </div>
            )}

            <div className="flex max-w-xs flex-col gap-2">
              <button
                onClick={() => router.push(`/patches?finding=${finding.id}`)}
                className="flex items-center justify-center gap-2 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-app transition hover:bg-mint/90"
              >
                <Send size={13} strokeWidth={2} />
                Send to Patch Gen
              </button>
              <button
                onClick={() => onDismiss(finding.id)}
                disabled={dismissed}
                className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-secondary transition hover:text-primary disabled:opacity-50"
              >
                <ShieldOff size={13} strokeWidth={2} />
                {dismissed ? "Marked as not a real issue" : "Mark Not a Real Issue"}
              </button>
              <button
                onClick={handleCreateDevTask}
                className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-secondary transition hover:border-mint/40 hover:text-primary"
              >
                <ClipboardPlus size={13} strokeWidth={2} />
                {taskCopied ? "Task copied to clipboard" : "Create Dev Task"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
