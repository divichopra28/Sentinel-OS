export interface DiffLine {
  text: string;
  type: "context" | "removed" | "added";
}

/** Splits a unified diff into the before/after columns a SplitDiffViewer renders. */
export function parseUnifiedDiff(diff: string): { before: DiffLine[]; after: DiffLine[] } {
  const before: DiffLine[] = [];
  const after: DiffLine[] = [];

  for (const line of diff.split("\n")) {
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@") || line.startsWith("diff ")) {
      continue;
    }
    if (line.startsWith("-")) {
      before.push({ text: line.slice(1), type: "removed" });
    } else if (line.startsWith("+")) {
      after.push({ text: line.slice(1), type: "added" });
    } else if (line.startsWith(" ")) {
      before.push({ text: line.slice(1), type: "context" });
      after.push({ text: line.slice(1), type: "context" });
    }
  }

  return { before, after };
}
