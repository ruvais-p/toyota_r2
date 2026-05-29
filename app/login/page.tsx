import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <LoginForm companyName={env.companyName} />
    </main>
  );
}
