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

/**
 * Process one slip and never throw: on failure it records the error on the slip
 * (status 'failed') and returns it. Used by the request-time dispatch/retry
 * paths, which run on serverless and can't rely on a background queue.
 */
export async function sendSlipSafely(
  slipId: number
): Promise<{ ok: boolean; to?: string; error?: string }> {
  try {
    const { to } = await processSlip(slipId);
    return { ok: true, to };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      await setSlipStatus(slipId, "failed", { error });
    } catch {
      /* status write itself failed — nothing more we can do here */
    }
    return { ok: false, error };
  }
}

/**
 * Process many slips with bounded concurrency (a shared browser is reused
 * across them). Returns a per-slip result keyed by slipId.
 */
export async function sendSlips(
  slipIds: number[],
  concurrency = Number(process.env.DISPATCH_CONCURRENCY ?? 2)
): Promise<Map<number, { ok: boolean; error?: string }>> {
  const results = new Map<number, { ok: boolean; error?: string }>();
  let next = 0;
  const limit = Math.min(Math.max(1, concurrency), slipIds.length || 1);

  async function worker(): Promise<void> {
    while (next < slipIds.length) {
      const id = slipIds[next++];
      const r = await sendSlipSafely(id);
      results.set(id, { ok: r.ok, error: r.error });
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
