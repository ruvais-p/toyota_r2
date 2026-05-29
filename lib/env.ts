/**
 * Centralised environment access. Server-only — never import from a Client
 * Component.
 *
 * Every field is a getter so `process.env` is read at ACCESS time, not at
 * import time. This matters for the queue worker: ES module imports are
 * hoisted, so this module can be evaluated before the worker calls
 * `dotenv.config()`. Lazy getters ensure `.env.local` values are picked up
 * regardless of import/load ordering.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get db() {
    return {
      host: process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_USER ?? "payroll",
      password: process.env.DATABASE_PASSWORD ?? "payroll",
      database: process.env.DATABASE_NAME ?? "payroll",
    };
  },
  get redisUrl() {
    return process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get smtp() {
    return {
      host: process.env.SMTP_HOST ?? "",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? "false") === "true",
      user: process.env.SMTP_USER ?? "",
      // App passwords (e.g. Gmail) are displayed with spaces for readability;
      // strip whitespace so they authenticate correctly over SMTP.
      pass: (process.env.SMTP_PASS ?? "").replace(/\s+/g, ""),
      from: process.env.SMTP_FROM ?? "Payroll <payroll@example.com>",
    };
  },
  get puppeteerExecutablePath() {
    return process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  },
  get companyName() {
    return process.env.COMPANY_NAME ?? "Company";
  },
};
