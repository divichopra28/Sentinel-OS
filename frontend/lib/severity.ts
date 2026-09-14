import type { Severity } from "./types";

export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#F1554C",
  high: "#F5A623",
  medium: "#4C9FF7",
  low: "#2FE6C4",
  info: "#8B93A7",
};

// Severity-low shares its hue with the mint accent by design (see spec) —
// text/bar/badge treatments dim it via opacity so it still reads as a step
// down from the accent color, not a second identical highlight.
export const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  critical: "bg-critical/15 text-critical border border-critical/40",
  high: "bg-high/15 text-high border border-high/40",
  medium: "bg-medium/15 text-medium border border-medium/40",
  low: "bg-mint/10 text-mint/70 border border-mint/30",
  info: "bg-secondary/10 text-secondary border border-secondary/30",
};

export const SEVERITY_TEXT_CLASSES: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-mint/70",
  info: "text-secondary",
};

export const SEVERITY_BAR_CLASSES: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-mint/60",
  info: "bg-secondary",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};
