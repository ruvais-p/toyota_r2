import { setSlipStatus } from "./repo";

/**
 * In-process salary-slip queue. No Redis, no BullMQ, no separate worker
 * process — jobs run inside the Next.js server itself, on a concurrency-limited
 * pool. `getSalaryQueue().add(...)` returns immediately; the slip is processed
 * in the background on the same process.
 *
 * Tradeoffs vs the old Redis/BullMQ setup:
 *   - Requires a single long-lived server process (`next start`), not a
 *     serverless/edge runtime that freezes after the response.
 *   - The pending list is in memory, so a restart drops un-started jobs. The DB
 *     is the source of truth: a slip left at 'queued'/'sending' can be re-sent
 *     via the retry endpoint.
 *   - With multiple server instances, a job only runs on the instance that
 *     accepted it. Fine for a single-instance deploy.
 */

export const SALARY_QUEUE_NAME = "salary-slips";

/** Job payload for one salary-slip email. */
export interface SlipJobData {
  slipId: number;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 5_000; // exponential: 5s, then 10s
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 3));

interface QueuedJob {
  id: string;
  slipId: number;
  attemptsMade: number;
}

class SalaryQueue {
  private pending: QueuedJob[] = [];
  private active = 0;
  private seq = 0;

  /** Enqueue a slip for sending. Returns a job id; processing is async. */
  async add(_name: string, data: SlipJobData): Promise<{ id: string }> {
    const id = `${Date.now()}-${++this.seq}`;
    this.pending.push({ id, slipId: data.slipId, attemptsMade: 0 });
    this.pump();
    return { id };
  }

  /** Snapshot for the health/dashboard view. */
  stats(): { pending: number; active: number } {
    return { pending: this.pending.length, active: this.active };
  }

  /** Start jobs until the concurrency limit is hit or the queue drains. */
  private pump(): void {
    while (this.active < CONCURRENCY && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active += 1;
      void this.run(job);
    }
  }

  private async run(job: QueuedJob): Promise<void> {
    job.attemptsMade += 1;
    try {
      // Lazy import keeps puppeteer/pdf out of the module graph (and out of any
      // route that only enqueues) until a job actually runs.
      const { processSlip } = await import("./process-slip");
      const result = await processSlip(job.slipId);
      console.log(`[queue] sent slip ${job.slipId} -> ${result?.to ?? "?"}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[queue] slip ${job.slipId} failed (attempt ${job.attemptsMade}/${MAX_ATTEMPTS}): ${message}`
      );
      if (job.attemptsMade < MAX_ATTEMPTS) {
        const delay = BACKOFF_BASE_MS * 2 ** (job.attemptsMade - 1);
        setTimeout(() => {
          this.pending.push(job);
          this.pump();
        }, delay);
      } else {
        // Record the terminal failure so the dashboard can surface it.
        try {
          await setSlipStatus(job.slipId, "failed", { error: message });
        } catch (e) {
          console.error("[queue] could not persist failure status:", e);
        }
      }
    } finally {
      this.active -= 1;
      this.pump();
    }
  }
}

const globalForQueue = globalThis as unknown as { __salaryQueue?: SalaryQueue };

export function getSalaryQueue(): SalaryQueue {
  if (!globalForQueue.__salaryQueue) {
    globalForQueue.__salaryQueue = new SalaryQueue();
  }
  return globalForQueue.__salaryQueue;
}
