import { requireApiSession } from "@/lib/auth";
import { parseSalarySheet } from "@/lib/parse";
import { getEmployeesByIds } from "@/lib/repo";
import { computeNetSalary } from "@/lib/salary";
import { readSheetFromForm } from "@/lib/sheet-source";
import type { SalaryPreviewRow } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const source = await readSheetFromForm(await request.formData());
  if ("error" in source) {
    return Response.json({ error: source.error }, { status: source.status });
  }

  let raw;
  try {
    raw = parseSalarySheet(source.buffer);
  } catch {
    return Response.json(
      { error: "Could not read the file. Provide a valid CSV or Excel sheet." },
      { status: 400 }
    );
  }

  // Look up every referenced employee from the master so the preview shows
  // their details and we can flag IDs that don't exist yet.
  const ids = [...new Set(raw.map((r) => r.employee_id).filter(Boolean))];
  const employees = await getEmployeesByIds(ids);

  const seen = new Map<string, number>();
  const rows: SalaryPreviewRow[] = raw.map((r) => {
    const errors = [...r.errors];
    const employee = employees.get(r.employee_id);
    if (r.employee_id && !employee) {
      errors.push("No matching employee — import the employee master first");
    }
    if (r.employee_id && r.month_year) {
      const key = `${r.employee_id}|${r.month_year}`;
      if (seen.has(key)) {
        errors.push(`Duplicate of row ${seen.get(key)} (same employee & month)`);
      } else {
        seen.set(key, r.rowNumber);
      }
    }

    const net = computeNetSalary(r);
    return {
      rowNumber: r.rowNumber,
      employee_id: r.employee_id,
      base_salary: r.base_salary,
      hra: r.hra,
      allowances: r.allowances,
      deductions: r.deductions,
      net_salary: net,
      month_year: r.month_year,
      name: employee?.name ?? null,
      email: employee?.email ?? null,
      designation: employee?.designation ?? null,
      errors,
    };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const months = [...new Set(rows.map((r) => r.month_year).filter(Boolean))];

  return Response.json({
    rows,
    summary: {
      total: rows.length,
      valid: validCount,
      invalid: rows.length - validCount,
      months,
    },
  });
}
