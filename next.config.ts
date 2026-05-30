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

// Files the PDF routes need at runtime that the tracer can't see:
//  - muhammara's native closure (loaded via a bundler-ignored import)
//  - @sparticuz/chromium's brotli pack in bin/ (read by computed fs path;
//    executablePath() decompresses it to /tmp, so bin/ must be in the bundle)
const PDF_INCLUDES = [
  ...MUHAMMARA_CLOSURE,
  "./node_modules/@sparticuz/chromium/bin/**/*",
];

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
  // Keys are globs: `[id]` would be read as a character class, so use `**` to
  // span the dynamic segment of the slip routes.
  outputFileTracingIncludes: {
    "/api/salary/dispatch": PDF_INCLUDES,
    "/api/slips/**/retry": PDF_INCLUDES,
    "/api/slips/**/pdf": PDF_INCLUDES,
  },
};

export default nextConfig;
