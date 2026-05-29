"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import type { SalaryPreviewRow } from "@/lib/types";
import { formatMoney, formatMonthYear } from "@/lib/salary";
import { SheetSource } from "@/components/sheet-source";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Summary {
  total: number;
  valid: number;
  invalid: number;
  months: string[];
}

export function PayrollUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SalaryPreviewRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  async function runPreview(body: FormData) {
    setRows(null);
    setSummary(null);
    setParsing(true);
    try {
      const res = await fetch("/api/salary/preview", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not parse the data");
        return;
      }
      setRows(data.rows);
      setSummary(data.summary);
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  function handleFile(f: File) {
    setFile(f);
    const body = new FormData();
    body.append("file", f);
    void runPreview(body);
  }

  function handleUrl(url: string) {
    setFile(null);
    const body = new FormData();
    body.append("url", url);
    void runPreview(body);
  }

  async function handleDispatch() {
    if (!rows) return;
    const valid = rows
      .filter((r) => r.errors.length === 0)
      .map((r) => ({
        employee_id: r.employee_id,
        base_salary: r.base_salary,
        hra: r.hra,
        allowances: r.allowances,
        deductions: r.deductions,
        month_year: r.month_year,
      }));
    if (valid.length === 0) {
      toast.error("There are no valid rows to dispatch.");
      return;
    }
    setDispatching(true);
    try {
      const res = await fetch("/api/salary/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Dispatch failed");
        return;
      }
      toast.success(`Queued ${data.queued} salary slip(s) for emailing.`);
      router.push("/slips");
      router.refresh();
    } catch {
      toast.error("Dispatch failed. Please try again.");
    } finally {
      setDispatching(false);
    }
  }

  const validCount = summary?.valid ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload monthly salary sheet</CardTitle>
          <CardDescription>
            Columns: <strong>Employee ID</strong>, <strong>Base Salary</strong>,{" "}
            <strong>HRA</strong>, <strong>Allowances</strong>,{" "}
            <strong>Deductions</strong>, <strong>Month/Year</strong>. Employee
            details are pulled from the master and Net Salary is computed for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SheetSource
            onFile={handleFile}
            onUrl={handleUrl}
            disabled={parsing || dispatching}
            busy={parsing}
            selectedName={file?.name ?? null}
          />
        </CardContent>
      </Card>

      {parsing && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Parsing & matching employees…
        </div>
      )}

      {rows && summary && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary">{summary.total} rows</Badge>
                <Badge className="bg-green-600">{summary.valid} valid</Badge>
                {summary.invalid > 0 && (
                  <Badge variant="destructive">{summary.invalid} with issues</Badge>
                )}
                {summary.months.map((m) => (
                  <Badge key={m} variant="outline">
                    {formatMonthYear(m)}
                  </Badge>
                ))}
              </CardDescription>
            </div>

            <Dialog>
              <DialogTrigger
                render={<Button disabled={dispatching || validCount === 0} />}
              >
                {dispatching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Generate &amp; email {validCount} slip(s)
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dispatch salary slips?</DialogTitle>
                  <DialogDescription>
                    This will generate password-protected PDF salary slips for{" "}
                    <strong>{validCount}</strong> employee(s)
                    {summary.months.length > 0 && (
                      <> for {summary.months.map(formatMonthYear).join(", ")}</>
                    )}{" "}
                    and queue them to be emailed. Existing slips for the same month
                    will be regenerated.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <DialogClose render={<Button onClick={handleDispatch} />}>
                    Confirm &amp; dispatch
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">HRA</TableHead>
                    <TableHead className="text-right">Allow.</TableHead>
                    <TableHead className="text-right">Deduct.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const invalid = row.errors.length > 0;
                    return (
                      <TableRow
                        key={row.rowNumber}
                        className={invalid ? "bg-destructive/5" : undefined}
                      >
                        <TableCell className="text-muted-foreground">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {row.name ?? row.employee_id}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {row.employee_id}
                            {row.email ? ` · ${row.email}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.base_salary)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.hra)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.allowances)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.deductions)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatMoney(row.net_salary)}
                        </TableCell>
                        <TableCell>
                          {row.month_year ? formatMonthYear(row.month_year) : "—"}
                        </TableCell>
                        <TableCell>
                          {invalid ? (
                            <span className="text-destructive flex items-center gap-1 text-xs">
                              <AlertCircle className="size-3.5" />
                              {row.errors.join("; ")}
                            </span>
                          ) : (
                            <Badge className="bg-green-600">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
