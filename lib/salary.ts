/**
 * Pure helpers for salary math, PDF password derivation, and formatting.
 * No server-only imports here so this can be unit-reasoned about and reused
 * on both the parsing path and the worker path.
 */

import type { Employee } from "./types";

/** Net Salary = (Base + HRA + Allowances) - Deductions. Rounded to 2dp. */
export function computeNetSalary(parts: {
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
}): number {
  const net =
    parts.base_salary + parts.hra + parts.allowances - parts.deductions;
  return Math.round(net * 100) / 100;
}

/** Uppercased alphabetic token from the employee's first name. */
function firstNameToken(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const alpha = first.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return alpha || "USER";
}

/**
 * Derive the PDF password from the employee's name + birth year.
 * Falls back to the employee id ("unique code") when no DOB is on file.
 * The same algorithm is communicated to employees in the email body via
 * `passwordHint()`, so the two MUST stay in sync.
 */
export function deriveSlipPassword(employee: Pick<Employee, "name" | "dob" | "employee_id">): string {
  const token = firstNameToken(employee.name);
  if (employee.dob) {
    const year = String(employee.dob).slice(0, 4);
    if (/^\d{4}$/.test(year)) return `${token}${year}`;
  }
  return `${token}${employee.employee_id}`;
}

/** Human-readable description of the password format, for the email body. */
export function passwordHint(employee: Pick<Employee, "name" | "dob">): string {
  const token = firstNameToken(employee.name);
  if (employee.dob) {
    return `your first name in capitals followed by your birth year (e.g. ${token} + birth year)`;
  }
  return `your first name in capitals followed by your employee ID`;
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return INR.format(amount);
}

/** "2026-05" -> "May 2026". Returns the input unchanged if not parseable. */
export function formatMonthYear(monthYear: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthYear);
  if (!match) return monthYear;
  const [, year, month] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-05-29" -> "29 May 2026". Returns the input unchanged if not parseable. */
export function formatLongDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ` ${ONES[ones]}` : "");
}

function threeDigitWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitWords(rest));
  return parts.join(" ");
}

/** Whole number to words using the Indian numbering system (Lakh/Crore). */
function integerToWords(value: number): string {
  if (value === 0) return "Zero";
  let n = value;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (n) parts.push(threeDigitWords(n));
  return parts.join(" ");
}

/** "57000.5" -> "Fifty Seven Thousand Rupees and Fifty Paise Only". */
export function amountInWordsINR(amount: number): string {
  const safe = Math.max(0, amount);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = `${integerToWords(rupees)} Rupee${rupees === 1 ? "" : "s"}`;
  const paiseWords = paise ? ` and ${twoDigitWords(paise)} Paise` : "";
  return `${rupeeWords}${paiseWords} Only`;
}
