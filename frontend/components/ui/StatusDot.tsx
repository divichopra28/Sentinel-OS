export type DotStatus = "running" | "idle" | "operational" | "error" | "done";

const DOT_COLOR: Record<DotStatus, string> = {
  running: "bg-running",
  idle: "bg-idle",
  operational: "bg-operational",
  done: "bg-operational",
  error: "bg-critical",
};

const DOT_LABEL: Record<DotStatus, string> = {
  running: "Running",
  idle: "Idle",
  operational: "Operational",
  done: "Done",
  error: "Error",
};

interface StatusDotProps {
  status: DotStatus;
  label?: string;
  className?: string;
}

export default function StatusDot({ status, label, className = "" }: StatusDotProps) {
  const text = label === "" ? "" : (label ?? DOT_LABEL[status]);
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`h-2 w-2 rounded-full ${DOT_COLOR[status]} ${status === "running" ? "animate-pulse-dot" : ""}`}
      />
      {text && <span className="text-xs text-secondary">{text}</span>}
    </span>
  );
}
