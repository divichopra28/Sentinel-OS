import { SEVERITY_BAR_CLASSES, SEVERITY_LABELS } from "@/lib/severity";
import type { Severity } from "@/lib/types";

interface HorizontalBarStatProps {
  counts: Partial<Record<Severity, number>>;
  severities?: Severity[];
}

export default function HorizontalBarStat({
  counts,
  severities = ["critical", "high", "medium", "low"],
}: HorizontalBarStatProps) {
  const max = Math.max(1, ...severities.map((s) => counts[s] ?? 0));

  return (
    <div className="space-y-3">
      {severities.map((severity) => {
        const value = counts[severity] ?? 0;
        const width = `${(value / max) * 100}%`;
        return (
          <div key={severity} className="flex items-center gap-3">
            <span className="w-16 shrink-0 font-mono text-[11px] font-semibold tracking-wide text-secondary">
              {SEVERITY_LABELS[severity]}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-panel-raised">
              <div
                className={`h-1.5 rounded-full ${SEVERITY_BAR_CLASSES[severity]}`}
                style={{ width: value > 0 ? width : "0%" }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-mono text-xs text-primary">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
