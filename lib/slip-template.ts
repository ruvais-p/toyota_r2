import { formatMoney, formatMonthYear } from "./salary";

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
  generatedOn: string; // human readable
}

function row(label: string, value: string, opts: { strong?: boolean } = {}): string {
  const cls = opts.strong ? ' class="strong"' : "";
  return `<tr${cls}><td>${label}</td><td class="amount">${value}</td></tr>`;
}

/**
 * Self-contained HTML for one salary slip. All CSS is inline in a <style> tag
 * so it renders identically in headless Chrome with no external assets.
 */
export function renderSlipHtml(data: SlipTemplateData): string {
  const gross = data.base_salary + data.hra + data.allowances;
  const initials =
    data.employee.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    font-size: 13px;
    padding: 40px;
    background: #fff;
  }
  .sheet { max-width: 760px; margin: 0 auto; }
  header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid #111827; padding-bottom: 18px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 52px; height: 52px; border-radius: 10px;
    background: #111827; color: #fff; font-weight: 700; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand h1 { font-size: 20px; letter-spacing: -0.3px; }
  .brand p { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 1px; }
  .doc-title p { color: #6b7280; font-size: 12px; margin-top: 4px; }

  .meta {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px;
    margin: 24px 0; padding: 18px; background: #f9fafb; border-radius: 10px;
  }
  .meta .field { display: flex; flex-direction: column; }
  .meta .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta .value { font-weight: 600; font-size: 13px; margin-top: 2px; }

  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .panel { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .panel h3 {
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;
    padding: 10px 14px; background: #111827; color: #fff;
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 9px 14px; border-bottom: 1px solid #f1f1f4; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  tr.strong td { font-weight: 700; background: #f9fafb; border-top: 1px solid #e5e7eb; }

  .net {
    margin-top: 22px; padding: 18px 22px; border-radius: 12px;
    background: #111827; color: #fff;
    display: flex; align-items: center; justify-content: space-between;
  }
  .net .net-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
  .net .net-value { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }

  footer { margin-top: 28px; color: #9ca3af; font-size: 11px; text-align: center; line-height: 1.6; }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">
        <div class="logo">${initials}</div>
        <div>
          <h1>${escapeHtml(data.companyName)}</h1>
          <p>Payroll Department</p>
        </div>
      </div>
      <div class="doc-title">
        <h2>Salary Slip</h2>
        <p>${escapeHtml(formatMonthYear(data.monthYear))}</p>
      </div>
    </header>

    <div class="meta">
      <div class="field"><span class="label">Employee Name</span><span class="value">${escapeHtml(data.employee.name)}</span></div>
      <div class="field"><span class="label">Employee ID</span><span class="value">${escapeHtml(data.employee.employee_id)}</span></div>
      <div class="field"><span class="label">Designation</span><span class="value">${escapeHtml(data.employee.designation || "—")}</span></div>
      <div class="field"><span class="label">Pay Period</span><span class="value">${escapeHtml(formatMonthYear(data.monthYear))}</span></div>
    </div>

    <div class="columns">
      <div class="panel">
        <h3>Earnings</h3>
        <table>
          ${row("Base Salary", formatMoney(data.base_salary))}
          ${row("House Rent Allowance", formatMoney(data.hra))}
          ${row("Allowances", formatMoney(data.allowances))}
          ${row("Gross Earnings", formatMoney(gross), { strong: true })}
        </table>
      </div>
      <div class="panel">
        <h3>Deductions</h3>
        <table>
          ${row("Deductions", formatMoney(data.deductions))}
          ${row("Total Deductions", formatMoney(data.deductions), { strong: true })}
        </table>
      </div>
    </div>

    <div class="net">
      <span class="net-label">Net Salary</span>
      <span class="net-value">${formatMoney(data.net_salary)}</span>
    </div>

    <footer>
      Net Salary = (Base Salary + HRA + Allowances) − Deductions.<br />
      This is a system-generated salary slip and does not require a signature.
      Generated on ${escapeHtml(data.generatedOn)}.
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
