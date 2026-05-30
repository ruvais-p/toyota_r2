import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for a small Docker image.
  output: "standalone",
  // Native/heavy server-only modules. Keep them external so Turbopack/webpack
  // does not try to bundle them into the server output.
  serverExternalPackages: ["muhammara", "puppeteer-core", "nodemailer"],
};

export default nextConfig;
