import { parseUnifiedDiff } from "@/lib/diff";
import type { Patch } from "@/lib/types";

interface SplitDiffViewerProps {
  patch: Patch;
  fileLabel?: string;
}

function DiffColumn({
  lines,
  prefixFor,
  tintFor,
}: {
  lines: { text: string; type: string }[];
  prefixFor: (type: string) => string;
  tintFor: (type: string) => string;
}) {
  if (lines.length === 0) {
    return <p className="p-3 text-sm text-secondary">No changes on this side.</p>;
  }
  return (
    <div className="scrollbar-thin overflow-x-auto py-1 font-mono text-[12.5px] leading-relaxed">
      {lines.map((line, index) => (
        <div key={index} className={`flex whitespace-pre px-3 py-0.5 ${tintFor(line.type)}`}>
          <span className="mr-2 w-3 shrink-0 select-none text-secondary/60">{prefixFor(line.type)}</span>
          <span className={line.type === "context" ? "text-secondary" : "text-primary/90"}>{line.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

export default function SplitDiffViewer({ patch, fileLabel }: SplitDiffViewerProps) {
  const { before, after } = parseUnifiedDiff(patch.diff);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-panel">
      {fileLabel && (
        <div className="border-b border-border px-4 py-2 font-mono text-[11px] text-secondary">{fileLabel}</div>
      )}
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-critical" />
              <span className="text-xs font-semibold text-primary">BEFORE (Vulnerable)</span>
            </div>
            <span className="rounded bg-critical/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-critical">
              VULNERABLE
            </span>
          </div>
          <DiffColumn
            lines={before}
            prefixFor={(t) => (t === "removed" ? "-" : " ")}
            tintFor={(t) => (t === "removed" ? "bg-critical/10" : "")}
          />
        </div>
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-mint" />
              <span className="text-xs font-semibold text-primary">AFTER (Patched)</span>
            </div>
            <span className="rounded bg-mint/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-mint">
              PATCHED
            </span>
          </div>
          <DiffColumn
            lines={after}
            prefixFor={(t) => (t === "added" ? "+" : " ")}
            tintFor={(t) => (t === "added" ? "bg-mint/10" : "")}
          />
        </div>
      </div>
    </div>
  );
}
