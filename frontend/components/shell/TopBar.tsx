"use client";

import { Bell, Search } from "lucide-react";

export default function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-app px-6">
      <div className="relative w-80 max-w-full">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
        <input
          type="text"
          placeholder="Search logs..."
          className="w-full rounded-md bg-panel py-2 pl-9 pr-3 text-sm text-primary placeholder:text-secondary focus:border focus:border-mint/40 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="text-secondary transition hover:text-primary">
          <Bell size={18} strokeWidth={2} />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-raised text-xs font-semibold text-primary">
          SO
        </div>
      </div>
    </header>
  );
}
