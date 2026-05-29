/**
 * Seed a few sample employees so you can try a payroll run immediately.
 *   npm run seed
 * Edit the emails below to your own address to receive real test mail.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { upsertEmployees } from "../lib/repo";

const SAMPLE = [
  { employee_id: "EMP001", name: "Aarav Sharma", email: "aarav@example.com", designation: "Sales Executive", dob: "1992-04-15" },
  { employee_id: "EMP002", name: "Diya Patel", email: "diya@example.com", designation: "Service Advisor", dob: "1990-11-02" },
  { employee_id: "EMP003", name: "Rohan Mehta", email: "rohan@example.com", designation: "Workshop Manager", dob: "1985-07-23" },
  { employee_id: "EMP004", name: "Ananya Iyer", email: "ananya@example.com", designation: "Accountant", dob: "1995-01-30" },
  { employee_id: "EMP005", name: "Vikram Nair", email: "vikram@example.com", designation: "Floor Supervisor", dob: "1988-09-12" },
];

async function main() {
  const count = await upsertEmployees(SAMPLE);
  console.log(`Seeded employees (affected rows: ${count}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
