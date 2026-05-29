"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Download,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { SlipWithEmployee, EmailStatus } from "@/lib/types";
import { formatMoney, formatMonthYear } from "@/lib/salary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ALL = "__all__";
const IN_FLIGHT: EmailStatus[] = ["pending", "queued", "sending"];

function StatusBadge({ status }: { status: EmailStatus }) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-green-600">
          <CheckCircle2 className="size-3" /> Sent
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="size-3" /> Failed
        </Badge>
      );
    case "sending":
      return (
        <Badge variant="secondary">
          <Loader2 className="size-3 animate-spin" /> Sending
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="secondary">
          <Clock className="size-3" /> Queued
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="size-3" /> Pending
        </Badge>
      );
  }
}

export function SlipsTable({
  months,
  initialMonth,
}: {
  months: string[];
  initialMonth: string | null;
}) {
  const [month, setMonth] = useState<string>(initialMonth ?? ALL);
  const [slips, setSlips] = useState<SlipWithEmployee[]>([]);
  const [monthList, setMonthList] = useState<string[]>(months);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetches the latest slips. State is only updated after the awaited fetch
  // (never synchronously), so this is safe to call from an effect.
  const load = useCallback(async () => {
    try {
      const qs = month === ALL ? "" : `?month=${encodeURIComponent(month)}`;
      const res = await fetch(`/api/slips${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setSlips(data.slips);
      setMonthList(data.months ?? []);
    } finally {
      setLoading(false);
    }
  }, [month]);

  // Load on mount / month change (spinner is toggled by the event handlers).
  useEffect(() => {
    load();
  }, [load]);

  // Poll while any slip is still in flight.
  useEffect(() => {
    const inFlight = slips.some((s) => IN_FLIGHT.includes(s.email_status));
    if (timer.current) clearTimeout(timer.current);
    if (inFlight) {
      timer.current = setTimeout(() => load(), 4000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [slips, load]);

  async function retry(id: number) {
    setRetrying(id);
    try {
      const res = await fetch(`/api/slips/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        toast.error("Could not requeue this slip.");
        return;
      }
      toast.success("Slip requeued.");
      await load();
    } finally {
      setRetrying(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Salary slips</CardTitle>
          <CardDescription>
            Dispatch status per employee. Updates automatically while sending.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={month}
            onValueChange={(v) => {
              setLoading(true);
              setMonth(v ?? ALL);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All months</SelectItem>
              {monthList.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthYear(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : slips.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No salary slips yet. Run a payroll dispatch to create some.
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((slip) => (
                  <TableRow key={slip.id}>
                    <TableCell>
                      <div className="font-medium">{slip.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {slip.employee_id} · {slip.email}
                      </div>
                    </TableCell>
                    <TableCell>{formatMonthYear(slip.month_year)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(slip.net_salary)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={slip.email_status} />
                      {slip.email_status === "failed" && slip.email_error && (
                        <p className="text-destructive mt-1 max-w-[220px] truncate text-xs" title={slip.email_error}>
                          {slip.email_error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false}
                          render={
                            <a
                              href={`/api/slips/${slip.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Download className="size-4" />
                          <span className="hidden sm:inline">PDF</span>
                        </Button>
                        {(slip.email_status === "failed" ||
                          slip.email_status === "sent") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retry(slip.id)}
                            disabled={retrying === slip.id}
                          >
                            {retrying === slip.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RotateCw className="size-4" />
                            )}
                            <span className="hidden sm:inline">
                              {slip.email_status === "failed" ? "Retry" : "Resend"}
                            </span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
