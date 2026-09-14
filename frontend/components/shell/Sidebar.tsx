"use client";

import {
  FileText,
  LayoutDashboard,
  LifeBuoy,
  ScanLine,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AgentStatusPanel from "@/components/AgentStatusPanel";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/patches", label: "Patches", icon: Wrench },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-mint" strokeWidth={2.25} fill="currentColor" fillOpacity={0.12} />
          <span className="text-[15px] font-bold text-primary">SentinelOS</span>
        </div>
        <p className="mt-1 pl-[2px] text-[10px] font-semibold uppercase tracking-widest text-secondary">
          Digital Command Center
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                active ? "bg-panel text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-3 pb-3">
        <AgentStatusPanel />
        <Link
          href="/agents"
          className="flex w-full items-center justify-center rounded-md border border-border py-2 text-xs font-medium text-secondary transition hover:border-mint/40 hover:text-mint"
        >
          System Agents
        </Link>
      </div>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <button className="flex w-full cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-secondary">
          <Settings size={16} strokeWidth={2} />
          Settings
        </button>
        <button className="flex w-full cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-secondary">
          <LifeBuoy size={16} strokeWidth={2} />
          Support
        </button>
      </div>
    </aside>
  );
}
