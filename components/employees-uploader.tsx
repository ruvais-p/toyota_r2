"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeRow } from "@/lib/types";
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

interface Summary {
  total: number;
  valid: number;
  invalid: number;
}

export function EmployeesUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<EmployeeRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function runPreview(body: FormData) {
    setRows(null);
    setSummary(null);
    setParsing(true);
    try {
      const res = await fetch("/api/employees/preview", { method: "POST", body });
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

  async function handleImport() {
    if (!rows) return;
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.error("There are no valid rows to import.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      toast.success(`Imported ${data.imported} employee(s).`);
      setFile(null);
      setRows(null);
      setSummary(null);
      router.refresh();
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload employee master</CardTitle>
          <CardDescription>
            Columns: <strong>Employee ID</strong>, <strong>Name</strong>,{" "}
            <strong>Email</strong>, <strong>Designation</strong>, and optionally{" "}
            <strong>DOB</strong> (used for the salary-slip PDF password).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SheetSource
            onFile={handleFile}
            onUrl={handleUrl}
            disabled={parsing || importing}
            busy={parsing}
            selectedName={file?.name ?? null}
          />
        </CardContent>
      </Card>

      {parsing && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Parsing file…
        </div>
      )}

      {rows && summary && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">{summary.total} rows</Badge>
                <Badge className="bg-green-600">{summary.valid} valid</Badge>
                {summary.invalid > 0 && (
                  <Badge variant="destructive">{summary.invalid} with issues</Badge>
                )}
              </CardDescription>
            </div>
            <Button onClick={handleImport} disabled={importing || summary.valid === 0}>
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import {summary.valid} employee(s)
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>DOB</TableHead>
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
                        <TableCell className="font-medium">
                          {row.employee_id || "—"}
                        </TableCell>
                        <TableCell>{row.name || "—"}</TableCell>
                        <TableCell>{row.email || "—"}</TableCell>
                        <TableCell>{row.designation || "—"}</TableCell>
                        <TableCell>{row.dob || "—"}</TableCell>
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
