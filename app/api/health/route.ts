import { requireApiSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSalaryQueue } from "@/lib/queue";
import { env } from "@/lib/env";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;

  const health = {
    db: false,
    redis: false,
    smtpConfigured: Boolean(env.smtp.host && env.smtp.user),
  };

  try {
    await query("SELECT 1");
    health.db = true;
  } catch {
    /* db down */
  }

  try {
    const client = (await getSalaryQueue().client) as unknown as {
      ping(): Promise<string>;
    };
    const pong = await client.ping();
    health.redis = pong === "PONG";
  } catch {
    /* redis down */
  }

  return Response.json(health);
}
