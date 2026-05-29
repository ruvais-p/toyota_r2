import { countEmployees } from "@/lib/repo";
import { PayrollUploader } from "@/components/payroll-uploader";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  let employees = 0;
  try {
    employees = await countEmployees();
  } catch {
    /* DB unavailable */
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Run</h1>
        <p className="text-muted-foreground mt-1">
          Upload a month&apos;s salary data, preview the computed slips, then queue
          them for emailing.
        </p>
      </div>

      {employees === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="text-muted-foreground size-8" />
            <p className="text-sm font-medium">No employees imported yet</p>
            <p className="text-muted-foreground max-w-md text-sm">
              Salary rows are matched to employees by Employee ID. Import the
              employee master before uploading a salary sheet.
            </p>
            <Button nativeButton={false} render={<Link href="/employees" />}>
              Go to Employees
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PayrollUploader />
      )}
    </div>
  );
}
