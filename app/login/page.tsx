import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }
  return (
    <main className="from-muted/40 via-background to-background relative flex min-h-svh items-center justify-center bg-gradient-to-b p-6">
      <div className="bg-primary/5 pointer-events-none absolute inset-x-0 top-0 h-64 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <LoginForm companyName={env.companyName} />
    </main>
  );
}
