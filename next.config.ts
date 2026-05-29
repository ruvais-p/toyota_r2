import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages are native/heavy server-only modules. Keep them external so
  // Turbopack/webpack does not try to bundle them into server output.
  serverExternalPackages: [
    "muhammara",
    "puppeteer-core",
    "bullmq",
    "ioredis",
    "mysql2",
    "nodemailer",
  ],
};

export default nextConfig;
