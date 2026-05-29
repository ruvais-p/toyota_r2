import {
  amountInWordsINR,
  formatLongDate,
  formatMoney,
  formatMonthYear,
} from "./salary";
import { getLogoDataUri } from "./branding";

export interface SlipTemplateData {
  companyName: string;
  monthYear: string; // YYYY-MM
  employee: {
    employee_id: string;
    name: string;
    email: string;
    designation: string;
  };
  base_salary: number;
  hra: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  generatedOn: string; // YYYY-MM-DD
}

interface LineItem {
  label: string;
  value: number;
}

/**
 * One row of the side-by-side earnings/deductions table. Either side may be
 * blank (the two columns rarely have the same number of line items).
 */
function payRow(earning: LineItem | null, deduction: LineItem | null): string {
  return `<tr>
    <td class="desc">${earning ? escapeHtml(earning.label) : ""}</td>
    <td class="amount">${earning ? formatMoney(earning.value) : ""}</td>
    <td class="desc">${deduction ? escapeHtml(deduction.label) : ""}</td>
    <td class="amount">${deduction ? formatMoney(deduction.value) : ""}</td>
  </tr>`;
}

/**
 * Self-contained HTML for one salary slip. All CSS is inline in a <style> tag
 * so it renders identically in headless Chrome with no external assets.
 */
export function renderSlipHtml(data: SlipTemplateData): string {
  const gross = data.base_salary + data.hra + data.allowances;
  const period = formatMonthYear(data.monthYear);
  const logo = getLogoDataUri();
  const initials =
    data.employee.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  const earnings: LineItem[] = [
    { label: "Basic Salary", value: data.base_salary },
    { label: "House Rent Allowance", value: data.hra },
    { label: "Other Allowances", value: data.allowances },
  ];
  const deductions: LineItem[] = [{ label: "Deductions", value: data.deductions }];

  const rowCount = Math.max(earnings.length, deductions.length);
  const bodyRows = Array.from({ length: rowCount }, (_, i) =>
    payRow(earnings[i] ?? null, deductions[i] ?? null)
  ).join("");

  const brandBlock = logo
    ? `<img class="logo-img" src="${logo}" alt="${escapeHtml(data.companyName)}" />`
    : `<div class="logo-fallback">${initials}</div>
       <div><p class="brand-name">${escapeHtml(data.companyName)}</p></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0f172a;
    --sub: #64748b;
    --line: #e5e7eb;
    --soft: #f8fafc;
    --brand: #c81e1e;
  }
  html, body { background: #fff; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    font-size: 12.5px;
    line-height: 1.4;
    padding: 40px 44px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 720px; margin: 0 auto; }

  /* Header */
  header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding-bottom: 18px; border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo-img { height: 40px; width: auto; display: block; }
  .logo-fallback {
    width: 48px; height: 48px; border-radius: 10px; background: var(--ink);
    color: #fff; font-weight: 700; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .doc { text-align: right; }
  .doc h1 {
    font-size: 17px; font-weight: 700; letter-spacing: 0.5px;
    text-transform: uppercase; color: var(--ink);
  }
  .doc .period { color: var(--sub); font-size: 12px; margin-top: 3px; }
  .doc .chip {
    display: inline-block; margin-top: 8px; padding: 3px 9px; border-radius: 999px;
    background: rgba(200, 30, 30, 0.08); color: var(--brand);
    font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
  }
  .accent { height: 3px; background: var(--brand); border-radius: 2px; margin-top: -1px; }

  /* Employee card */
  .employee {
    display: flex; align-items: center; gap: 22px;
    margin: 22px 0; padding: 16px 18px;
    background: var(--soft); border: 1px solid var(--line); border-radius: 12px;
  }
  .employee .who { display: flex; align-items: center; gap: 12px; min-width: 200px; }
  .avatar {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: var(--ink); color: #fff; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .who .name { font-size: 14px; font-weight: 700; }
  .who .role { color: var(--sub); font-size: 11.5px; margin-top: 1px; }
  .emp-grid {
    flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;
    border-left: 1px solid var(--line); padding-left: 22px;
  }
  .emp-grid .field { display: flex; flex-direction: column; }
  .emp-grid .k {
    color: var(--sub); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px;
  }
  .emp-grid .v { font-weight: 600; font-size: 12.5px; margin-top: 1px; word-break: break-word; }

  /* Pay table */
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--sub); margin: 4px 0 10px;
  }
  table.pay {
    width: 100%; border-collapse: collapse;
    border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
  }
  table.pay thead th {
    background: var(--ink); color: #fff; font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.6px; padding: 10px 14px; text-align: left;
  }
  table.pay thead th.amount { text-align: right; }
  table.pay td {
    padding: 9px 14px; border-top: 1px solid var(--line); font-size: 12.5px;
  }
  table.pay td.desc { color: var(--ink); }
  table.pay td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  table.pay td:nth-child(2) { border-right: 1px solid var(--line); }
  table.pay tbody tr:first-child td { border-top: none; }
  table.pay tfoot td {
    background: var(--soft); font-weight: 700; border-top: 1.5px solid var(--line);
  }
  table.pay tfoot td.desc { text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; }

  /* Net pay hero */
  .net {
    margin-top: 18px; padding: 18px 22px; border-radius: 12px; background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
  }
  .net .net-label {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.7);
  }
  .net .net-words { font-size: 11.5px; margin-top: 4px; color: rgba(255,255,255,0.92); max-width: 380px; }
  .net .net-value {
    font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap;
  }

  /* Footer */
  footer {
    margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--line);
    color: #94a3b8; font-size: 10px; line-height: 1.7;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  }
  footer .note { max-width: 420px; }
  footer .sign { text-align: center; color: var(--sub); }
  footer .sign .line { width: 150px; border-top: 1px solid var(--line); margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">${brandBlock}</div>
      <div class="doc">
        <h1>Salary Slip</h1>
        <p class="period">${escapeHtml(period)}</p>
        <span class="chip">Confidential</span>
      </div>
    </header>
    <div class="accent"></div>

    <section class="employee">
      <div class="who">
        <div class="avatar">${initials}</div>
        <div>
          <p class="name">${escapeHtml(data.employee.name)}</p>
          <p class="role">${escapeHtml(data.employee.designation || "Employee")}</p>
        </div>
      </div>
      <div class="emp-grid">
        <div class="field"><span class="k">Employee ID</span><span class="v">${escapeHtml(data.employee.employee_id)}</span></div>
        <div class="field"><span class="k">Pay Period</span><span class="v">${escapeHtml(period)}</span></div>
        <div class="field"><span class="k">Email</span><span class="v">${escapeHtml(data.employee.email)}</span></div>
        <div class="field"><span class="k">Pay Date</span><span class="v">${escapeHtml(formatLongDate(data.generatedOn))}</span></div>
      </div>
    </section>

    <p class="section-title">Earnings &amp; Deductions</p>
    <table class="pay">
      <thead>
        <tr>
          <th>Earnings</th>
          <th class="amount">Amount</th>
          <th>Deductions</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
      <tfoot>
        <tr>
          <td class="desc">Gross Earnings</td>
          <td class="amount">${formatMoney(gross)}</td>
          <td class="desc">Total Deductions</td>
          <td class="amount">${formatMoney(data.deductions)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="net">
      <div>
        <p class="net-label">Net Salary Payable</p>
        <p class="net-words">${escapeHtml(amountInWordsINR(data.net_salary))}</p>
      </div>
      <span class="net-value">${formatMoney(data.net_salary)}</span>
    </div>

    <footer>
      <div class="note">
        Net Salary = (Basic + HRA + Allowances) − Deductions.<br />
        This is a system-generated salary slip and does not require a signature.
        Generated on ${escapeHtml(formatLongDate(data.generatedOn))}.
      </div>
      <div class="sign">
        <div class="line"></div>
        Authorised Signatory
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
