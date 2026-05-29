import { listSlipMonths } from "@/lib/repo";
import { SlipsTable } from "@/components/slips-table";

export const dynamic = "force-dynamic";

export default async function SlipsPage() {
  let months: string[] = [];
  try {
    months = await listSlipMonths();
  } catch {
    /* DB unavailable; the client table will surface the empty state */
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salary Slips</h1>
        <p className="text-muted-foreground mt-1">
          Track email delivery, download generated PDFs, and retry failures.
        </p>
      </div>
      <SlipsTable months={months} initialMonth={months[0] ?? null} />
    </div>
  );
}
