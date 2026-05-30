import { requireApiSession } from "@/lib/auth";
import { getSlipWithEmployee } from "@/lib/repo";
import { sendSlipSafely } from "@/lib/process-slip";

// Generating + emailing the PDF runs inline (no background worker on serverless).
export const runtime = "nodejs";
export const maxDuration = 60;

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

  const r = await sendSlipSafely(slipId);
  if (!r.ok) {
    return Response.json({ ok: false, error: r.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
