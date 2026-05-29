import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "./env";

export const SALARY_QUEUE_NAME = "salary-slips";

/** Job payload for one salary-slip email. */
export interface SlipJobData {
  slipId: number;
}

/**
 * BullMQ connection options. `maxRetriesPerRequest: null` is required by
 * BullMQ workers; we use the same options for the producer for consistency.
 */
export const connection: ConnectionOptions = (() => {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
  };
})();

const globalForQueue = globalThis as unknown as {
  __salaryQueue?: Queue<SlipJobData>;
};

export function getSalaryQueue(): Queue<SlipJobData> {
  if (!globalForQueue.__salaryQueue) {
    globalForQueue.__salaryQueue = new Queue<SlipJobData>(SALARY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return globalForQueue.__salaryQueue;
}
