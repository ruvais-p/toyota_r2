import { requireApiSession } from "@/lib/auth";
import { getSlipWithEmployee } from "@/lib/repo";
import { renderEncryptedSlipPdf } from "@/lib/pdf";
import { deriveSlipPassword } from "@/lib/salary";
import { env } from "@/lib/env";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/slips/[id]/pdf">
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

  const password = deriveSlipPassword({
    name: slip.name,
    dob: slip.dob ?? null,
    employee_id: slip.employee_id,
  });

  const pdf = await renderEncryptedSlipPdf(
    {
      companyName: env.companyName,
      monthYear: slip.month_year,
      employee: {
        employee_id: slip.employee_id,
        name: slip.name,
        email: slip.email,
        designation: slip.designation,
      },
      base_salary: slip.base_salary,
      hra: slip.hra,
      allowances: slip.allowances,
      deductions: slip.deductions,
      net_salary: slip.net_salary,
      generatedOn: new Date().toISOString().slice(0, 10),
    },
    password
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="salary-slip-${slip.employee_id}-${slip.month_year}.pdf"`,
    },
  });
}
