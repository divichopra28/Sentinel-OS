import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PanelHeaderProps {
  icon?: LucideIcon;
  label: string;
  right?: ReactNode;
}

export default function PanelHeader({ icon: Icon, label, right }: PanelHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-secondary">
        {Icon && <Icon size={13} strokeWidth={2} />}
        <span>{label}</span>
      </div>
      {right}
    </div>
  );
}
