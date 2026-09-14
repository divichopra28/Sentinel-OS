import type { Config } from "tailwindcss";

// Design tokens for the "digital command center" aesthetic — a fixed dark
// theme, so unlike a typical Tailwind setup there is no light-mode branch.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#0A0E14",
        sidebar: "#0B0F17",
        panel: "#111826",
        "panel-raised": "#161E2E",
        border: "#1F2937",
        primary: "#F3F4F6",
        secondary: "#8B93A7",
        mint: "#2FE6C4",
        critical: "#F1554C",
        high: "#F5A623",
        medium: "#4C9FF7",
        low: "#2FE6C4",
        running: "#F5A623",
        idle: "#4B5563",
        operational: "#2FE6C4",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
