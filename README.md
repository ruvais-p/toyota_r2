# Payroll Portal — Automated Salary Slip Pipeline

Upload an employee payroll sheet and the system generates structured,
**password-protected** salary-slip PDFs and emails them to each employee through
a background queue.

Built with **Next.js 16** (App Router), **MySQL**, **BullMQ + Redis**,
**Puppeteer** (PDF generation), **muhammara** (PDF encryption),
**Nodemailer** (SMTP), and **shadcn/ui** (responsive UI).

---

## Features

- **Admin dashboard & upload portal** — password-gated admin login; upload
  payroll data as CSV or Excel.
- **Employee master** — `Employee ID, Name, Email, Designation, DOB`. Uploaded
  rows are previewed (with validation) before import.
- **Monthly salary upload** — `Employee ID, Base Salary, HRA, Allowances,
  Deductions, Month/Year`. Employee details are fetched from the DB by
  `Employee ID`; a preview table shows the joined data with the computed net
  salary before you trigger the automation.
- **Net salary** — `Net = (Base + HRA + Allowances) − Deductions`, computed and
  shown on the slip.
- **Dynamic PDF engine** — a clean, professional A4 salary-slip PDF per employee.
- **Password protection** — each PDF is AES-encrypted. The password is the
  employee's **first name (in capitals) + birth year** (e.g. `AARAV1992`), or
  first name + Employee ID when no DOB is on file.
- **Queued email dispatch** — BullMQ queue + a worker process. Each employee
  receives an HTML email addressing them by name, stating the pay month, and
  attaching their slip. Automatic retries with backoff; per-slip delivery status
  is tracked and shown in the dashboard (with retry/resend).

---

## Prerequisites

- **Node.js 20.9+**
- **Docker** (for MySQL + Redis) — or your own MySQL 8 and Redis instances
- A **Chrome/Chromium** binary for PDF rendering (Puppeteer uses
  `puppeteer-core`). Set `PUPPETEER_EXECUTABLE_PATH` if it isn't auto-detected.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    then edit .env.local — at minimum set ADMIN_PASSWORD, SESSION_SECRET,
#    and the SMTP_* values so emails can be delivered.

# 3. Start MySQL + Redis (schema is auto-applied on first boot)
npm run infra:up

# 4. (Optional) Seed a few sample employees
npm run seed
```

> Sample spreadsheets you can upload are in [`samples/`](./samples).

## Running

The app and the email worker are **two separate processes** — run both:

```bash
# Terminal 1 — web app
npm run dev            # http://localhost:3000

# Terminal 2 — email worker (generates PDFs and sends mail)
npm run worker
```

Sign in with `ADMIN_PASSWORD`, then:

1. **Employees** → upload the employee master, review the preview, import.
2. **Payroll Run** → upload the month's salary sheet, review the computed
   slips, click **Generate & email**.
3. **Salary Slips** → watch delivery status update live; download any PDF or
   retry failures.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection (defaults match `docker-compose.yml`) |
| `REDIS_URL` | Redis connection for the BullMQ queue |
| `ADMIN_PASSWORD` | Password for the admin dashboard |
| `SESSION_SECRET` | Secret used to sign the session cookie |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | SMTP credentials for Nodemailer |
| `PUPPETEER_EXECUTABLE_PATH` | Path to Chrome/Chromium (auto-detected if blank) |
| `COMPANY_NAME` | Branding shown on the UI, PDFs, and emails |
| `WORKER_CONCURRENCY` | (optional) parallel jobs in the worker, default `3` |

## Architecture

```
Admin (browser)
   │  upload CSV/XLSX, preview, dispatch
   ▼
Next.js App Router  ──────────────────────────────┐
   • /api/employees/*  parse + import (MySQL)      │
   • /api/salary/preview  join + compute net       │
   • /api/salary/dispatch  persist slips + enqueue ┼──▶ BullMQ queue (Redis)
   • /api/slips/*  status, PDF download, retry      │
                                                    ▼
                                       Worker process (npm run worker)
                                         1. load slip + employee (MySQL)
                                         2. render HTML → PDF (Puppeteer)
                                         3. AES-encrypt PDF (muhammara)
                                         4. email via SMTP (Nodemailer)
                                         5. update slip status (sent/failed)
```

Database tables (see [`db/schema.sql`](./db/schema.sql)):

- **`employees`** — `employee_id` (PK), name, email, designation, dob
- **`salary_slips`** — one row per `(employee_id, month_year)` with the salary
  components, computed `net_salary`, and the email dispatch status.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js app |
| `npm run worker` | Start the email worker |
| `npm run build` | Production build |
| `npm run infra:up` / `infra:down` | Start / stop MySQL + Redis |
| `npm run seed` | Insert sample employees |

## Notes

- **PDF password format** is intentionally simple and is communicated to each
  employee in the email body. Adjust the algorithm in `lib/salary.ts`
  (`deriveSlipPassword` / `passwordHint`) if you want a different scheme.
- The worker uses `puppeteer-core` and your system Chrome to avoid a large
  Chromium download. `muhammara` provides PDF encryption without needing the
  `qpdf` system binary.
