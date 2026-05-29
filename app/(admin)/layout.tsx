import { requireSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <div className="min-h-svh">
      <AdminNav companyName={env.companyName} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
