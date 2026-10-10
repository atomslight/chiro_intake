import { createHmac, timingSafeEqual } from "crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

/** Practice-side access: a server-checked passcode exchanged for a signed, httpOnly session cookie. */
const COOKIE = "ci_practice";
const MAX_AGE = 60 * 60 * 12;

function sign(payload: string): string {
  const key = process.env["ADMIN_SESSION_SECRET"];
  if (!key) throw new Error("Server is missing ADMIN_SESSION_SECRET.");
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passcodeConfigured() { return Boolean(process.env["PRACTICE_ADMIN_PASSCODE"]); }

export function checkPasscode(input: string): boolean {
  const expected = process.env["PRACTICE_ADMIN_PASSCODE"];
  if (!expected) return false;
  return safeEqual(sign(`pc:${input}`), sign(`pc:${expected}`));
}

export function startAdminSession() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  setCookie(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: MAX_AGE });
}

export function endAdminSession() { deleteCookie(COOKIE, { path: "/", secure: true, sameSite: "none" }); }

export function isAdmin(): boolean {
  const raw = getCookie(COOKIE);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try { return safeEqual(sig, sign(exp)); } catch { return false; }
}

export function requireAdmin() {
  if (!isAdmin()) throw new Error("Practice sign-in required.");
}
