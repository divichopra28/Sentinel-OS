import { SEVERITY_BADGE_CLASSES, SEVERITY_LABELS } from "@/lib/severity";
import type { Severity } from "@/lib/types";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export default function SeverityBadge({ severity, className = "" }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${SEVERITY_BADGE_CLASSES[severity]} ${className}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
