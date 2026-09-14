import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AssistButton from "@/components/shell/AssistButton";
import Sidebar from "@/components/shell/Sidebar";
import TopBar from "@/components/shell/TopBar";
import { ScanProvider } from "@/lib/scan-context";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "SentinelOS — Digital Command Center",
  description: "Autonomous security operations: scan, analyze, simulate, patch, and score risk in real time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-app font-sans text-primary antialiased">
        <ScanProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-y-auto bg-app">{children}</main>
            </div>
          </div>
          <AssistButton />
        </ScanProvider>
      </body>
    </html>
  );
}
