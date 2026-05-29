import { requireApiSession } from "@/lib/auth";
import { parseEmployeeSheet } from "@/lib/parse";
import { readSheetFromForm } from "@/lib/sheet-source";

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const source = await readSheetFromForm(await request.formData());
  if ("error" in source) {
    return Response.json({ error: source.error }, { status: source.status });
  }

  let rows;
  try {
    rows = parseEmployeeSheet(source.buffer);
  } catch {
    return Response.json(
      { error: "Could not read the file. Provide a valid CSV or Excel sheet." },
      { status: 400 }
    );
  }

  // Flag duplicate employee IDs within the uploaded sheet.
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.employee_id) continue;
    if (seen.has(row.employee_id)) {
      row.errors.push(`Duplicate of row ${seen.get(row.employee_id)}`);
    } else {
      seen.set(row.employee_id, row.rowNumber);
    }
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  return Response.json({
    rows,
    summary: { total: rows.length, valid: validCount, invalid: rows.length - validCount },
  });
}
