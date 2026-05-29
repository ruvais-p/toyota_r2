/** Shared domain types used across the server and client. */

export type EmailStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "failed";

export interface Employee {
  employee_id: string;
  name: string;
  email: string;
  designation: string;
  dob: string | null; // YYYY-MM-DD
}

export interface SalarySlip {
  id: number;
  employee_id: string;
  month_year: string; // YYYY-MM
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  email_status: EmailStatus;
  email_error: string | null;
  job_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A salary slip row joined with its employee, used for previews and listings. */
export interface SlipWithEmployee extends SalarySlip {
  name: string;
  email: string;
  designation: string;
  dob?: string | null; // present when joined for PDF generation
}

/** One parsed-and-validated employee row from an uploaded sheet. */
export interface EmployeeRow {
  rowNumber: number;
  employee_id: string;
  name: string;
  email: string;
  designation: string;
  dob: string | null;
  errors: string[];
}

/** One parsed salary row, joined against the DB employee, ready for preview. */
export interface SalaryPreviewRow {
  rowNumber: number;
  employee_id: string;
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  month_year: string;
  // Joined from the employee master (null when the employee is unknown).
  name: string | null;
  email: string | null;
  designation: string | null;
  errors: string[];
}
