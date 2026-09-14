"use client";

import { Activity } from "lucide-react";
import PanelHeader from "@/components/ui/PanelHeader";
import StatusDot, { type DotStatus } from "@/components/ui/StatusDot";
import { useScan } from "@/lib/scan-context";
import { AGENT_LABELS, AGENT_ORDER, type AgentStatus } from "@/lib/types";

function toDotStatus(status: AgentStatus): DotStatus {
  if (status === "running") return "running";
  if (status === "done") return "done";
  if (status === "error") return "error";
  return "idle";
}

/** Sidebar mini-widget: live status of all 6 agents for the active scan. */
export default function AgentStatusPanel() {
  const { scan } = useScan();

  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <PanelHeader icon={Activity} label="Agent Status" />
      <ul className="space-y-2">
        {AGENT_ORDER.map((agent) => {
          const status = scan?.agent_statuses[agent] ?? "idle";
          return (
            <li key={agent} className="flex items-center justify-between">
              <span className="truncate text-xs text-primary/90">{AGENT_LABELS[agent].replace(" Agent", "")}</span>
              <StatusDot status={toDotStatus(status)} label="" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
