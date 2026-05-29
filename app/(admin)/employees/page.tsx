import { listEmployees } from "@/lib/repo";
import { EmployeesUploader } from "@/components/employees-uploader";
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

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  let employees: Awaited<ReturnType<typeof listEmployees>> = [];
  try {
    employees = await listEmployees();
  } catch {
    /* DB not reachable; show empty state */
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-muted-foreground mt-1">
          Import and review the employee master. Salary uploads are matched against
          these records by Employee ID.
        </p>
      </div>

      <EmployeesUploader />

      <Card>
        <CardHeader>
          <CardTitle>Current employees ({employees.length})</CardTitle>
          <CardDescription>Everyone currently in the master table.</CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No employees yet. Upload a sheet above to get started.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>DOB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.employee_id}>
                      <TableCell className="font-medium">{e.employee_id}</TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell>{e.email}</TableCell>
                      <TableCell>{e.designation || "—"}</TableCell>
                      <TableCell>{e.dob || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
