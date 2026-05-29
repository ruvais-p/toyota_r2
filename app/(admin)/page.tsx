import Link from "next/link";
import {
  Users,
  FileSpreadsheet,
  MailCheck,
  MailX,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { countEmployees, getSlipStats } from "@/lib/repo";
import { getSalaryQueue } from "@/lib/queue";
import { env } from "@/lib/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getHealth() {
  const health = {
    db: false,
    redis: false,
    smtp: Boolean(env.smtp.host && env.smtp.user),
  };
  try {
    await countEmployees();
    health.db = true;
  } catch {}
  try {
    const client = (await getSalaryQueue().client) as unknown as {
      ping(): Promise<string>;
    };
    health.redis = (await client.ping()) === "PONG";
  } catch {}
  return health;
}

export default async function DashboardPage() {
  // Tolerate a missing DB so the dashboard still renders with guidance.
  let employees = 0;
  let stats = { total: 0, sent: 0, failed: 0, pending: 0 };
  let dbError = false;
  try {
    [employees, stats] = await Promise.all([countEmployees(), getSlipStats()]);
  } catch {
    dbError = true;
  }
  const health = await getHealth();

  const metrics = [
    { label: "Employees", value: employees, icon: Users, href: "/employees" },
    { label: "Slips total", value: stats.total, icon: FileSpreadsheet, href: "/slips" },
    { label: "Emails sent", value: stats.sent, icon: MailCheck, href: "/slips" },
    { label: "Pending", value: stats.pending, icon: Clock, href: "/slips" },
    { label: "Failed", value: stats.failed, icon: MailX, href: "/slips" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Upload payroll sheets, generate salary slips, and email them to employees.
        </p>
      </div>

      {dbError && (
        <Card className="border-destructive/40">
          <CardContent className="text-sm">
            <p className="text-destructive font-medium">
              Cannot reach the database.
            </p>
            <p className="text-muted-foreground mt-1">
              Start the infrastructure with{" "}
              <code className="bg-muted rounded px-1 py-0.5">npm run infra:up</code>{" "}
              and ensure your <code className="bg-muted rounded px-1 py-0.5">.env.local</code>{" "}
              database settings are correct.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={m.href}>
              <Card className="hover:border-primary/40 h-full transition-colors">
                <CardContent className="flex flex-col gap-2">
                  <Icon className="text-muted-foreground size-5" />
                  <div className="text-2xl font-semibold">{m.value}</div>
                  <div className="text-muted-foreground text-xs">{m.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Three steps to dispatch a payroll run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                n: 1,
                title: "Import the employee master",
                body: "Upload a CSV/Excel with Employee ID, Name, Email, Designation (and DOB for PDF passwords).",
                href: "/employees",
                cta: "Go to Employees",
              },
              {
                n: 2,
                title: "Upload the monthly salary sheet",
                body: "Upload Employee ID, Base Salary, HRA, Allowances, Deductions and Month/Year. Net salary is computed automatically.",
                href: "/payroll",
                cta: "Go to Payroll Run",
              },
              {
                n: 3,
                title: "Review & dispatch",
                body: "Preview the joined data, then queue password-protected PDF slips to be emailed to each employee.",
                href: "/slips",
                cta: "View Salary Slips",
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-4">
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {step.n}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{step.body}</p>
                  <Button
                    variant="link"
                    className="h-auto px-0"
                    nativeButton={false}
                    render={<Link href={step.href} />}
                  >
                    {step.cta} <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service status</CardTitle>
            <CardDescription>Required background services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow ok={health.db} label="MySQL database" />
            <StatusRow ok={health.redis} label="Redis (queue)" />
            <StatusRow
              ok={health.smtp}
              label="SMTP configured"
              hint={health.smtp ? undefined : "Set SMTP_* in .env.local"}
            />
            <p className="text-muted-foreground border-t pt-3 text-xs">
              Remember to run the email worker:{" "}
              <code className="bg-muted rounded px-1 py-0.5">npm run worker</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="size-4 text-green-600" />
        ) : (
          <XCircle className="text-destructive size-4" />
        )}
        {label}
      </span>
      <span className="text-muted-foreground text-xs">
        {ok ? "OK" : hint ?? "Unavailable"}
      </span>
    </div>
  );
}
