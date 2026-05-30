import { requireApiSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getSalaryQueue } from "@/lib/queue";
import { env } from "@/lib/env";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;

  const health = {
    db: false,
    queue: false,
    smtpConfigured: Boolean(env.smtp.host && env.smtp.user),
  };

  try {
    const { error } = await getSupabase()
      .from("employees")
      .select("employee_id", { count: "exact", head: true });
    if (error) throw error;
    health.db = true;
  } catch {
    /* db down */
  }

  // In-process queue: available whenever the server is running.
  health.queue = Boolean(getSalaryQueue());

  return Response.json({ ...health, ...getSalaryQueue().stats() });
}
