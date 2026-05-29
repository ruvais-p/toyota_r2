import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

export const SESSION_COOKIE = "payroll_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(value: string): string {
  return crypto
    .createHmac("sha256", env.sessionSecret)
    .update(value)
    .digest("base64url");
}

/** Create a signed, expiring session token. */
export function createSessionToken(): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a token's signature and expiry. Constant-time signature compare. */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [subject, expires, signature] = parts;
  const payload = `${subject}.${expires}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  return true;
}

/** Constant-time check of an admin password attempt. */
export function checkPassword(attempt: string): boolean {
  const expected = Buffer.from(env.adminPassword);
  const got = Buffer.from(attempt);
  if (expected.length !== got.length) return false;
  return crypto.timingSafeEqual(expected, got);
}

/** Whether the current request carries a valid session (reads cookies()). */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** For Server Components / pages: redirect to /login when unauthenticated. */
export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

/** For Route Handlers: returns a 401 Response when unauthenticated, else null. */
export async function requireApiSession(): Promise<Response | null> {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
