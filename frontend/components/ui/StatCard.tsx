import type { LucideIcon } from "lucide-react";

export type StatColor = "white" | "red" | "mint" | "orange";

const COLOR_CLASSES: Record<StatColor, string> = {
  white: "text-primary",
  red: "text-critical",
  mint: "text-mint",
  orange: "text-high",
};

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: LucideIcon;
  color?: StatColor;
}

export default function StatCard({ label, value, suffix, icon: Icon, color = "white" }: StatCardProps) {
  return (
    <div className="rounded-md border border-border bg-panel px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-secondary">
        {Icon && <Icon size={12} strokeWidth={2} />}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1 font-mono">
        <span className={`text-2xl font-semibold ${COLOR_CLASSES[color]}`}>{value}</span>
        {suffix && <span className="text-sm text-secondary">{suffix}</span>}
      </div>
    </div>
  );
}
