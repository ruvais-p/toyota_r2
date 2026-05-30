import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { getEmployeesByIds, upsertSlip } from "@/lib/repo";
import { computeNetSalary } from "@/lib/salary";
import { sendSlips } from "@/lib/process-slip";

// PDF generation (headless Chromium) is slow; give the function room. On Vercel
// Hobby the ceiling is 60s — split very large payroll runs into smaller batches.
export const runtime = "nodejs";
export const maxDuration = 60;

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

  type Result = {
    employee_id: string;
    month_year: string;
    status: "sent" | "failed" | "skipped" | "error";
    error?: string;
  };
  const results: Result[] = [];
  // Persist every valid slip first, collecting the ids to process.
  const toSend: { slipId: number; row: (typeof parsed.rows)[number] }[] = [];

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
    try {
      const slipId = await upsertSlip({ ...row, net_salary: net });
      toSend.push({ slipId, row });
    } catch (e) {
      results.push({
        employee_id: row.employee_id,
        month_year: row.month_year,
        status: "error",
        error: e instanceof Error ? e.message : "DB error",
      });
    }
  }

  // Generate + email the PDFs inline (no background worker on serverless).
  const sentMap = await sendSlips(toSend.map((s) => s.slipId));
  for (const { slipId, row } of toSend) {
    const r = sentMap.get(slipId);
    results.push({
      employee_id: row.employee_id,
      month_year: row.month_year,
      status: r?.ok ? "sent" : "failed",
      error: r?.ok ? undefined : r?.error,
    });
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  return Response.json({
    ok: true,
    sent,
    failed,
    total: parsed.rows.length,
    results,
  });
}
