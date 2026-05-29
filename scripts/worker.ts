/**
 * Salary-slip email worker.
 *
 * Runs as a standalone process (separate from the Next.js server):
 *   npm run worker
 *
 * It consumes jobs from the BullMQ "salary-slips" queue, generates a
 * password-protected PDF for each slip, and emails it to the employee.
 */
import { config as loadEnv } from "dotenv";
// The worker is not started by Next.js, so load .env.local ourselves.
loadEnv({ path: ".env.local" });
loadEnv(); // also pick up plain .env if present

import { Worker, type Job } from "bullmq";
import { SALARY_QUEUE_NAME, connection, type SlipJobData } from "../lib/queue";
import { processSlip } from "../lib/process-slip";
import { setSlipStatus } from "../lib/repo";
import { closeBrowser } from "../lib/pdf";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 3);

const worker = new Worker<SlipJobData>(
  SALARY_QUEUE_NAME,
  async (job: Job<SlipJobData>) => {
    const { slipId } = job.data;
    const result = await processSlip(slipId);
    return result;
  },
  { connection, concurrency: CONCURRENCY }
);

worker.on("ready", () => {
  console.log(
    `[worker] ready — listening on "${SALARY_QUEUE_NAME}" (concurrency ${CONCURRENCY})`
  );
});

worker.on("completed", (job, result: { to: string }) => {
  console.log(`[worker] sent slip ${job.data.slipId} -> ${result?.to ?? "?"}`);
});

worker.on("failed", async (job, err) => {
  if (!job) {
    console.error("[worker] job failed (no job ref):", err.message);
    return;
  }
  const attemptsAllowed = job.opts.attempts ?? 1;
  const final = job.attemptsMade >= attemptsAllowed;
  console.error(
    `[worker] slip ${job.data.slipId} failed (attempt ${job.attemptsMade}/${attemptsAllowed}): ${err.message}`
  );
  if (final) {
    // Record the terminal failure so the dashboard can surface it.
    try {
      await setSlipStatus(job.data.slipId, "failed", { error: err.message });
    } catch (e) {
      console.error("[worker] could not persist failure status:", e);
    }
  }
});

worker.on("error", (err) => {
  console.error("[worker] error:", err.message);
});

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down...`);
  await worker.close();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
