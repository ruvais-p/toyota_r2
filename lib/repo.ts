import { getPool, query, execute, type RowDataPacket } from "./db";
import type { Employee, SlipWithEmployee, EmailStatus } from "./types";

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
  const values = rows.map((r) => [
    r.employee_id,
    r.name,
    r.email,
    r.designation,
    r.dob,
  ]);
  const sql = `
    INSERT INTO employees (employee_id, name, email, designation, dob)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      designation = VALUES(designation),
      dob = VALUES(dob)`;
  const [result] = await getPool().query(sql, [values]);
  // affectedRows counts 1 per insert, 2 per update.
  return (result as { affectedRows: number }).affectedRows;
}

export async function listEmployees(): Promise<Employee[]> {
  return query<Employee & RowDataPacket>(
    `SELECT employee_id, name, email, designation, dob
     FROM employees ORDER BY name ASC`
  );
}

export async function getEmployeesByIds(
  ids: string[]
): Promise<Map<string, Employee>> {
  const map = new Map<string, Employee>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query<Employee & RowDataPacket>(
    `SELECT employee_id, name, email, designation, dob
     FROM employees WHERE employee_id IN (${placeholders})`,
    ids
  );
  for (const row of rows) map.set(row.employee_id, row);
  return map;
}

export async function countEmployees(): Promise<number> {
  const rows = await query<RowDataPacket & { c: number }>(
    `SELECT COUNT(*) AS c FROM employees`
  );
  return rows[0]?.c ?? 0;
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

/**
 * Insert a slip, or replace an existing one for the same (employee, month).
 * Resets email status to 'pending' so it can be (re)dispatched. Returns the id.
 */
export async function upsertSlip(slip: SlipInput): Promise<number> {
  const sql = `
    INSERT INTO salary_slips
      (employee_id, month_year, base_salary, hra, allowances, deductions, net_salary, email_status, email_error, sent_at, job_id)
    VALUES
      (:employee_id, :month_year, :base_salary, :hra, :allowances, :deductions, :net_salary, 'pending', NULL, NULL, NULL)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id),
      base_salary = VALUES(base_salary),
      hra = VALUES(hra),
      allowances = VALUES(allowances),
      deductions = VALUES(deductions),
      net_salary = VALUES(net_salary),
      email_status = 'pending',
      email_error = NULL,
      sent_at = NULL,
      job_id = NULL`;
  const result = await execute(sql, { ...slip });
  return result.insertId;
}

export async function getSlipWithEmployee(
  slipId: number
): Promise<SlipWithEmployee | null> {
  const rows = await query<SlipWithEmployee & RowDataPacket>(
    `SELECT s.*, e.name, e.email, e.designation, e.dob
     FROM salary_slips s
     JOIN employees e ON e.employee_id = s.employee_id
     WHERE s.id = :id`,
    { id: slipId }
  );
  return rows[0] ?? null;
}

export async function listSlips(monthYear?: string): Promise<SlipWithEmployee[]> {
  if (monthYear) {
    return query<SlipWithEmployee & RowDataPacket>(
      `SELECT s.*, e.name, e.email, e.designation
       FROM salary_slips s
       JOIN employees e ON e.employee_id = s.employee_id
       WHERE s.month_year = :month
       ORDER BY e.name ASC`,
      { month: monthYear }
    );
  }
  return query<SlipWithEmployee & RowDataPacket>(
    `SELECT s.*, e.name, e.email, e.designation
     FROM salary_slips s
     JOIN employees e ON e.employee_id = s.employee_id
     ORDER BY s.month_year DESC, e.name ASC`
  );
}

export async function listSlipMonths(): Promise<string[]> {
  const rows = await query<RowDataPacket & { month_year: string }>(
    `SELECT DISTINCT month_year FROM salary_slips ORDER BY month_year DESC`
  );
  return rows.map((r) => r.month_year);
}

export interface SlipStats {
  total: number;
  sent: number;
  failed: number;
  pending: number; // pending + queued + sending
}

export async function getSlipStats(): Promise<SlipStats> {
  const rows = await query<RowDataPacket & { email_status: EmailStatus; c: number }>(
    `SELECT email_status, COUNT(*) AS c FROM salary_slips GROUP BY email_status`
  );
  const stats: SlipStats = { total: 0, sent: 0, failed: 0, pending: 0 };
  for (const row of rows) {
    stats.total += row.c;
    if (row.email_status === "sent") stats.sent += row.c;
    else if (row.email_status === "failed") stats.failed += row.c;
    else stats.pending += row.c;
  }
  return stats;
}

export async function setSlipStatus(
  slipId: number,
  status: EmailStatus,
  extra: { error?: string | null; jobId?: string | null; sent?: boolean } = {}
): Promise<void> {
  await execute(
    `UPDATE salary_slips
     SET email_status = :status,
         email_error = :error,
         job_id = COALESCE(:jobId, job_id),
         sent_at = ${extra.sent ? "CURRENT_TIMESTAMP" : "sent_at"}
     WHERE id = :id`,
    {
      id: slipId,
      status,
      error: extra.error ?? null,
      jobId: extra.jobId ?? null,
    }
  );
}
