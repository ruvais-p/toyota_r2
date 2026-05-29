import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { upsertEmployees } from "@/lib/repo";

const RowSchema = z.object({
  employee_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  designation: z.string().default(""),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

const BodySchema = z.object({ rows: z.array(RowSchema) });

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid employee data" }, { status: 400 });
  }

  // De-duplicate by employee_id (last one wins) before upserting.
  const byId = new Map<string, (typeof parsed.rows)[number]>();
  for (const row of parsed.rows) byId.set(row.employee_id, row);
  const rows = [...byId.values()];

  if (rows.length === 0) {
    return Response.json({ error: "No valid rows to import" }, { status: 400 });
  }

  await upsertEmployees(rows);
  return Response.json({ ok: true, imported: rows.length });
}
