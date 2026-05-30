import { getSupabase } from "./supabase";
import type { Employee, SalarySlip, SlipWithEmployee, EmailStatus } from "./types";

/**
 * Data access via the Supabase JS client (PostgREST over HTTPS), not raw pg.
 * Function signatures are unchanged so every caller (route handlers, pages, and
 * the BullMQ worker via process-slip) keeps working as-is.
 *
 * Notes on the PostgREST translation:
 *   - ON CONFLICT ... DO UPDATE  ->  .upsert(values, { onConflict })
 *   - JOIN employees             ->  embedded select "*, employees(...)" (FK-backed)
 *   - GROUP BY                    ->  not supported; use head:true count queries
 *   - ORDER BY a joined column    ->  not supported on parent rows; sort in JS
 */

const EMP_COLS = "employee_id, name, email, designation, dob";

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

interface EmployeeInput {
  employee_id: string;
  name: string;
  email: string;
  designation: string;
  dob: string | null;
}

/** Bulk insert/update employees keyed by employee_id. Returns the row count. */
export async function upsertEmployees(rows: EmployeeInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error, count } = await getSupabase()
    .from("employees")
    .upsert(rows, { onConflict: "employee_id", count: "exact" });
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select(EMP_COLS)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

export async function getEmployeesByIds(
  ids: string[]
): Promise<Map<string, Employee>> {
  const map = new Map<string, Employee>();
  if (ids.length === 0) return map;
  const { data, error } = await getSupabase()
    .from("employees")
    .select(EMP_COLS)
    .in("employee_id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Employee[]) map.set(row.employee_id, row);
  return map;
}

export async function countEmployees(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("employees")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Salary slips
// ---------------------------------------------------------------------------

interface SlipInput {
  employee_id: string;
  month_year: string;
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
  net_salary: number;
}

/** Shape returned by PostgREST when embedding the employee into a slip row. */
type SlipJoinRow = SalarySlip & {
  employees: {
    name: string;
    email: string;
    designation: string;
    dob?: string | null;
  } | null;
};

/** Flatten an embedded {slip, employees:{...}} row into the flat SlipWithEmployee. */
function flattenSlip(row: SlipJoinRow): SlipWithEmployee {
  const { employees, ...slip } = row;
  return {
    ...slip,
    name: employees?.name ?? "",
    email: employees?.email ?? "",
    designation: employees?.designation ?? "",
    dob: employees?.dob ?? null,
  };
}

/**
 * Insert a slip, or replace an existing one for the same (employee, month).
 * Resets email status to 'pending' so it can be (re)dispatched. Returns the id.
 */
export async function upsertSlip(slip: SlipInput): Promise<number> {
  const { data, error } = await getSupabase()
    .from("salary_slips")
    .upsert(
      {
        ...slip,
        email_status: "pending",
        email_error: null,
        sent_at: null,
        job_id: null,
      },
      { onConflict: "employee_id,month_year" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: number }).id;
}

export async function getSlipWithEmployee(
  slipId: number
): Promise<SlipWithEmployee | null> {
  const { data, error } = await getSupabase()
    .from("salary_slips")
    .select("*, employees(name, email, designation, dob)")
    .eq("id", slipId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? flattenSlip(data as unknown as SlipJoinRow) : null;
}

export async function listSlips(monthYear?: string): Promise<SlipWithEmployee[]> {
  let q = getSupabase()
    .from("salary_slips")
    .select("*, employees(name, email, designation)");
  if (monthYear) q = q.eq("month_year", monthYear);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as SlipJoinRow[]).map(flattenSlip);
  // PostgREST can't ORDER BY an embedded column on parent rows, so do it here.
  // Filtered: by employee name. Unfiltered: newest month first, then name.
  rows.sort((a, b) =>
    monthYear
      ? a.name.localeCompare(b.name)
      : b.month_year.localeCompare(a.month_year) || a.name.localeCompare(b.name)
  );
  return rows;
}

export async function listSlipMonths(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("salary_slips")
    .select("month_year")
    .order("month_year", { ascending: false });
  if (error) throw new Error(error.message);

  // PostgREST has no DISTINCT; dedupe in JS, preserving the DESC order.
  const seen = new Set<string>();
  const months: string[] = [];
  for (const r of (data ?? []) as { month_year: string }[]) {
    if (!seen.has(r.month_year)) {
      seen.add(r.month_year);
      months.push(r.month_year);
    }
  }
  return months;
}

export interface SlipStats {
  total: number;
  sent: number;
  failed: number;
  pending: number; // pending + queued + sending
}

export async function getSlipStats(): Promise<SlipStats> {
  const sb = getSupabase();
  // No GROUP BY in PostgREST: run head-only count queries (no rows transferred).
  const countWhere = async (status?: EmailStatus): Promise<number> => {
    let q = sb.from("salary_slips").select("*", { count: "exact", head: true });
    if (status) q = q.eq("email_status", status);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [total, sent, failed] = await Promise.all([
    countWhere(),
    countWhere("sent"),
    countWhere("failed"),
  ]);
  // Everything that isn't sent/failed counts as pending (queued/sending/pending).
  return { total, sent, failed, pending: total - sent - failed };
}

export async function setSlipStatus(
  slipId: number,
  status: EmailStatus,
  extra: { error?: string | null; jobId?: string | null; sent?: boolean } = {}
): Promise<void> {
  const patch: Record<string, unknown> = {
    email_status: status,
    email_error: extra.error ?? null,
  };
  // COALESCE(:jobId, job_id): only overwrite job_id when a new one is supplied.
  if (extra.jobId != null) patch.job_id = extra.jobId;
  // sent_at = CURRENT_TIMESTAMP only when marking sent; otherwise leave it.
  if (extra.sent) patch.sent_at = new Date().toISOString();

  const { error } = await getSupabase()
    .from("salary_slips")
    .update(patch)
    .eq("id", slipId);
  if (error) throw new Error(error.message);
}
