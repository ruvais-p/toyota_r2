import * as XLSX from "xlsx";
import type { EmployeeRow } from "./types";

/**
 * Spreadsheet parsing for the two upload flows. Accepts both CSV and Excel
 * (.xlsx/.xls) because SheetJS reads them all. Column headers are matched
 * loosely (case/spacing/punctuation insensitive) against known aliases so
 * admins don't have to format their export exactly.
 */

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Alias -> canonical field. Keys are already normalized.
const EMPLOYEE_ALIASES: Record<string, keyof RawEmployee> = {
  employeeid: "employee_id",
  empid: "employee_id",
  id: "employee_id",
  name: "name",
  employeename: "name",
  fullname: "name",
  email: "email",
  emailid: "email",
  mail: "email",
  designation: "designation",
  title: "designation",
  role: "designation",
  position: "designation",
  dob: "dob",
  dateofbirth: "dob",
  birthdate: "dob",
  birthday: "dob",
};

const SALARY_ALIASES: Record<string, keyof RawSalary> = {
  employeeid: "employee_id",
  empid: "employee_id",
  id: "employee_id",
  basesalary: "base_salary",
  base: "base_salary",
  basic: "base_salary",
  basicsalary: "base_salary",
  hra: "hra",
  houserentallowance: "hra",
  allowances: "allowances",
  allowance: "allowances",
  otherallowances: "allowances",
  deductions: "deductions",
  deduction: "deductions",
  netsalary: "_ignore",
  monthyear: "month_year",
  month: "month_year",
  period: "month_year",
  salarymonth: "month_year",
};

interface RawEmployee {
  employee_id?: unknown;
  name?: unknown;
  email?: unknown;
  designation?: unknown;
  dob?: unknown;
}

interface RawSalary {
  employee_id?: unknown;
  base_salary?: unknown;
  hra?: unknown;
  allowances?: unknown;
  deductions?: unknown;
  month_year?: unknown;
  _ignore?: unknown;
}

export interface RawSalaryRow {
  rowNumber: number;
  employee_id: string;
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
  month_year: string;
  errors: string[];
}

/** Read the first worksheet of a workbook into header-keyed JSON rows. */
function readSheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
}

/** Remap a raw row's headers onto canonical field names using an alias map. */
function remap<T>(row: Record<string, unknown>, aliases: Record<string, string>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = aliases[normalizeKey(key)];
    if (canonical && canonical !== "_ignore") out[canonical] = value;
  }
  return out as T;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Coerce a DOB cell (Date, ISO string, or common DD/MM/YYYY) to YYYY-MM-DD. */
function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return null;
}

/** Coerce a month cell (Date, "YYYY-MM", "MM/YYYY", "May 2026") to YYYY-MM. */
function toMonthYear(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 7);
  const my = /^(\d{1,2})[/-](\d{4})$/.exec(str); // MM/YYYY
  if (my) return `${my[2]}-${pad2(Number(my[1]))}`;
  const ym = /^(\d{4})[/-](\d{1,2})$/.exec(str); // YYYY/MM
  if (ym) return `${ym[1]}-${pad2(Number(ym[2]))}`;
  const parsed = new Date(str); // e.g. "May 2026"
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}`;
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmployeeSheet(buffer: Buffer): EmployeeRow[] {
  const rows = readSheet(buffer);
  return rows.map((rawRow, index) => {
    const raw = remap<RawEmployee>(rawRow, EMPLOYEE_ALIASES);
    const errors: string[] = [];

    const employee_id = toStr(raw.employee_id);
    const name = toStr(raw.name);
    const email = toStr(raw.email);
    const designation = toStr(raw.designation);
    const dob = toDateOnly(raw.dob);

    if (!employee_id) errors.push("Missing Employee ID");
    if (!name) errors.push("Missing Name");
    if (!email) errors.push("Missing Email");
    else if (!EMAIL_RE.test(email)) errors.push("Invalid email format");

    return {
      rowNumber: index + 2, // +2: 1 for header row, 1 for 1-based display
      employee_id,
      name,
      email,
      designation,
      dob,
      errors,
    };
  });
}

export function parseSalarySheet(buffer: Buffer): RawSalaryRow[] {
  const rows = readSheet(buffer);
  return rows.map((rawRow, index) => {
    const raw = remap<RawSalary>(rawRow, SALARY_ALIASES);
    const errors: string[] = [];

    const employee_id = toStr(raw.employee_id);
    if (!employee_id) errors.push("Missing Employee ID");

    const base_salary = toMoney(raw.base_salary);
    const hra = toMoney(raw.hra);
    const allowances = toMoney(raw.allowances);
    const deductions = toMoney(raw.deductions);
    const month_year = toMonthYear(raw.month_year);

    if (base_salary === null) errors.push("Missing/invalid Base Salary");
    if (!month_year) errors.push("Missing/invalid Month/Year");
    for (const [label, val] of [
      ["HRA", hra],
      ["Allowances", allowances],
      ["Deductions", deductions],
    ] as const) {
      if (val !== null && val < 0) errors.push(`${label} cannot be negative`);
    }
    if (base_salary !== null && base_salary < 0)
      errors.push("Base Salary cannot be negative");

    return {
      rowNumber: index + 2,
      employee_id,
      base_salary: base_salary ?? 0,
      hra: hra ?? 0,
      allowances: allowances ?? 0,
      deductions: deductions ?? 0,
      month_year: month_year ?? "",
      errors,
    };
  });
}
