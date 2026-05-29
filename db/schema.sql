-- Payroll pipeline schema (MySQL 8)
-- This file is auto-applied by the MySQL container on first boot
-- (mounted into /docker-entrypoint-initdb.d). It is also safe to run
-- manually: `mysql -u payroll -ppayroll payroll < db/schema.sql`.

CREATE TABLE IF NOT EXISTS employees (
  employee_id  VARCHAR(50)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  designation  VARCHAR(255) NOT NULL DEFAULT '',
  -- Used (with the employee name) to derive the salary-slip PDF password.
  dob          DATE         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS salary_slips (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  employee_id  VARCHAR(50)   NOT NULL,
  month_year   VARCHAR(7)    NOT NULL,            -- format: YYYY-MM
  base_salary  DECIMAL(12,2) NOT NULL DEFAULT 0,
  hra          DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowances   DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions   DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- net = (base + hra + allowances) - deductions, persisted for the slip record.
  net_salary   DECIMAL(12,2) NOT NULL DEFAULT 0,
  email_status ENUM('pending','queued','sending','sent','failed') NOT NULL DEFAULT 'pending',
  email_error  TEXT          NULL,
  job_id       VARCHAR(120)  NULL,
  sent_at      TIMESTAMP     NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_emp_month (employee_id, month_year),
  KEY idx_month (month_year),
  KEY idx_status (email_status),
  CONSTRAINT fk_slip_employee FOREIGN KEY (employee_id)
    REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
