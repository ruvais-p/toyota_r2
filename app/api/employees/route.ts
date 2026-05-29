import { requireApiSession } from "@/lib/auth";
import { listEmployees } from "@/lib/repo";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const employees = await listEmployees();
  return Response.json({ employees });
}
