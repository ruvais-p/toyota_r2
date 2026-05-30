import type { NextConfig } from "next";

// muhammara is loaded via a bundler-ignored dynamic import (Turbopack can't
// parse its native package.json), so the tracer can't see it. Force-include the
// package and its runtime dependency closure into the serverless function
// bundles for the routes that generate/encrypt PDFs.
const MUHAMMARA_CLOSURE = [
  "muhammara",
  "@xmldom/xmldom",
  "linebreak",
  "memory-streams",
  "base64-js",
  "core-util-is",
  "inherits",
  "isarray",
  "pako",
  "readable-stream",
  "string_decoder",
  "tiny-inflate",
  "unicode-trie",
].map((p) => `./node_modules/${p}/**/*`);

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for the Docker image.
  // (Vercel ignores this and uses its own per-route function tracing.)
  output: "standalone",
  // Native/heavy server-only modules — keep them external so Turbopack/webpack
  // does not try to bundle them into the server output.
  serverExternalPackages: [
    "muhammara",
    "puppeteer-core",
    "@sparticuz/chromium",
    "nodemailer",
  ],
  outputFileTracingIncludes: {
    "/api/salary/dispatch": MUHAMMARA_CLOSURE,
    "/api/slips/[id]/retry": MUHAMMARA_CLOSURE,
    "/api/slips/[id]/pdf": MUHAMMARA_CLOSURE,
  },
};

export default nextConfig;
