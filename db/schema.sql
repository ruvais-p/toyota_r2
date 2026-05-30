-- Payroll pipeline schema (PostgreSQL / Supabase)
-- Apply in the Supabase SQL Editor, or manually:
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS employees (
  employee_id  VARCHAR(50)  PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  designation  VARCHAR(255) NOT NULL DEFAULT '',
  -- Used (with the employee name) to derive the salary-slip PDF password.
  dob          DATE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_slips (
  id           BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id  VARCHAR(50)   NOT NULL
                 REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  month_year   VARCHAR(7)    NOT NULL,                 -- format: YYYY-MM
  base_salary  NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra          NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances   NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions   NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- net = (base + hra + allowances) - deductions, persisted for the slip record.
  net_salary   NUMERIC(12,2) NOT NULL DEFAULT 0,
  email_status VARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (email_status IN ('pending','queued','sending','sent','failed')),
  email_error  TEXT,
  job_id       VARCHAR(120),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uniq_emp_month UNIQUE (employee_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_month  ON salary_slips (month_year);
CREATE INDEX IF NOT EXISTS idx_status ON salary_slips (email_status);

-- Postgres has no "ON UPDATE CURRENT_TIMESTAMP"; emulate it with a trigger so
-- updated_at tracks row changes the way the old MySQL schema did.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_salary_slips_updated_at ON salary_slips;
CREATE TRIGGER trg_salary_slips_updated_at
  BEFORE UPDATE ON salary_slips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
