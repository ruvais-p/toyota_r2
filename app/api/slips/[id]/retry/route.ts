import { requireApiSession } from "@/lib/auth";
import { getSlipWithEmployee, setSlipStatus } from "@/lib/repo";
import { getSalaryQueue } from "@/lib/queue";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/slips/[id]/retry">
) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const { id } = await ctx.params;
  const slipId = Number(id);
  if (!Number.isInteger(slipId)) {
    return Response.json({ error: "Invalid slip id" }, { status: 400 });
  }

  const slip = await getSlipWithEmployee(slipId);
  if (!slip) {
    return Response.json({ error: "Slip not found" }, { status: 404 });
  }

  const job = await getSalaryQueue().add("send-slip", { slipId });
  await setSlipStatus(slipId, "queued", { jobId: String(job.id), error: null });
  return Response.json({ ok: true });
}
