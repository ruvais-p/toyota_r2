"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Mail,
  LogOut,
  Loader2,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll Run", icon: FileSpreadsheet },
  { href: "/slips", label: "Salary Slips", icon: Mail },
];

export function AdminNav({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const Brand = (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt={companyName}
        className="h-8 w-auto rounded-md bg-white p-1 ring-1 ring-border/60"
      />
      <span className="text-muted-foreground border-l pl-2.5 text-xs leading-tight">
        Payroll
        <br />
        Portal
      </span>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="bg-background/80 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        {Brand}
      </div>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          "bg-background fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0 shadow-xl" : "-translate-x-full lg:shadow-none"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          {Brand}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t p-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            onClick={logout}
            disabled={loggingOut}
            className="text-muted-foreground hover:text-foreground h-9 w-full justify-start gap-3 px-3"
          >
            {loggingOut ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <LogOut className="size-4.5" />
            )}
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: theme is only known on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div className="bg-muted/60 flex items-center gap-1 rounded-lg p-1">
      {options.map((o) => {
        const Icon = o.icon;
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-label={`${o.label} theme`}
            aria-pressed={active}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1.5 transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
