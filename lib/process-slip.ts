import { env } from "./env";
import { getSlipWithEmployee, setSlipStatus } from "./repo";
import { renderEncryptedSlipPdf } from "./pdf";
import { sendSlipEmail } from "./mailer";
import { deriveSlipPassword, passwordHint } from "./salary";

/**
 * Process one queued salary slip: generate the password-protected PDF and
 * email it to the employee. Updates the slip's status as it progresses.
 * Throws on failure so BullMQ can retry; the final failure is recorded by the
 * worker's "failed" handler.
 */
export async function processSlip(slipId: number): Promise<{ to: string }> {
  const slip = await getSlipWithEmployee(slipId);
  if (!slip) {
    throw new Error(`Salary slip ${slipId} not found`);
  }

  await setSlipStatus(slipId, "sending");

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

  await sendSlipEmail({
    to: slip.email,
    employeeName: slip.name,
    monthYear: slip.month_year,
    pdf,
    passwordHint: passwordHint({ name: slip.name, dob: slip.dob ?? null }),
  });

  await setSlipStatus(slipId, "sent", { sent: true });
  return { to: slip.email };
}
