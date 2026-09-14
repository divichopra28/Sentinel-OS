import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this package — the parent Desktop folder has an
  // unrelated stray package-lock.json that Next.js would otherwise pick as
  // the workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
