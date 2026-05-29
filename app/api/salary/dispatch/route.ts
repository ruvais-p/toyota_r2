import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { getEmployeesByIds, upsertSlip, setSlipStatus } from "@/lib/repo";
import { computeNetSalary } from "@/lib/salary";
import { getSalaryQueue } from "@/lib/queue";

const RowSchema = z.object({
  employee_id: z.string().min(1),
  base_salary: z.number(),
  hra: z.number(),
  allowances: z.number(),
  deductions: z.number(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/),
});

const BodySchema = z.object({ rows: z.array(RowSchema).min(1) });

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid salary data" }, { status: 400 });
  }

  // Re-validate employee existence server-side — never trust the client list.
  const ids = [...new Set(parsed.rows.map((r) => r.employee_id))];
  const employees = await getEmployeesByIds(ids);

  const queue = getSalaryQueue();
  const results: { employee_id: string; month_year: string; status: string; error?: string }[] = [];
  let queued = 0;

  for (const row of parsed.rows) {
    if (!employees.has(row.employee_id)) {
      results.push({
        employee_id: row.employee_id,
        month_year: row.month_year,
        status: "skipped",
        error: "Unknown employee",
      });
      continue;
    }

    const net = computeNetSalary(row);
    let slipId: number;
    try {
      slipId = await upsertSlip({ ...row, net_salary: net });
    } catch (e) {
      results.push({
        employee_id: row.employee_id,
        month_year: row.month_year,
        status: "error",
        error: e instanceof Error ? e.message : "DB error",
      });
      continue;
    }

    // No fixed jobId: re-dispatching a month should always enqueue a fresh job
    // (e.g. to retry a previously failed slip).
    const job = await queue.add("send-slip", { slipId });
    await setSlipStatus(slipId, "queued", { jobId: String(job.id) });
    queued += 1;
    results.push({ employee_id: row.employee_id, month_year: row.month_year, status: "queued" });
  }

  return Response.json({ ok: true, queued, total: parsed.rows.length, results });
}
