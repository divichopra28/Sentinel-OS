export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSeconds < 60) return "just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export function repoDisplayName(repoUrl: string | null): string {
  if (!repoUrl) return "Uploaded archive";
  const trimmed = repoUrl.replace(/\.git$/, "").replace(/\/+$/, "");
  const parts = trimmed.split("/");
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  return trimmed;
}
