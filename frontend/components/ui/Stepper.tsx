import { AlertTriangle, Check } from "lucide-react";
import type { AgentName, AgentStatus } from "@/lib/types";
import { STEPPER_STEPS } from "@/lib/types";

type StepState = "upcoming" | "active" | "complete" | "error";

function stepState(status: AgentStatus | undefined): StepState {
  if (status === "done") return "complete";
  if (status === "running") return "active";
  if (status === "error") return "error";
  return "upcoming";
}

interface StepperProps {
  agentStatuses?: Partial<Record<AgentName, AgentStatus>>;
}

export default function Stepper({ agentStatuses }: StepperProps) {
  const rawStates = STEPPER_STEPS.map((step) => stepState(agentStatuses?.[step.agent]));

  // If nothing has run yet, present step 1 as the active starting point
  // rather than every step looking equally "upcoming".
  const states: StepState[] =
    !agentStatuses && rawStates.every((s) => s === "upcoming")
      ? rawStates.map((s, i) => (i === 0 ? "active" : s))
      : rawStates;

  return (
    <div className="flex w-full items-center border-b border-border bg-panel px-6 py-4">
      {STEPPER_STEPS.map((step, index) => {
        const state = states[index];
        const isLast = index === STEPPER_STEPS.length - 1;

        return (
          <div key={step.agent} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "complete"
                    ? "bg-mint text-app"
                    : state === "active"
                      ? "bg-mint text-app"
                      : state === "error"
                        ? "bg-critical text-app"
                        : "border border-idle text-secondary"
                }`}
              >
                {state === "complete" ? (
                  <Check size={14} strokeWidth={3} />
                ) : state === "error" ? (
                  <AlertTriangle size={13} strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`whitespace-nowrap text-sm font-medium ${
                  state === "upcoming" ? "text-secondary" : state === "error" ? "text-critical" : "text-primary"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-3 h-px flex-1 ${
                  state === "complete" ? "bg-mint" : state === "error" ? "bg-critical/50" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
