import { requireApiSession } from "@/lib/auth";
import { listSlips, listSlipMonths } from "@/lib/repo";

export async function GET(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? undefined;

  const [slips, months] = await Promise.all([
    listSlips(month),
    listSlipMonths(),
  ]);

  return Response.json({ slips, months });
}
