import crypto from "crypto";
import { isCloudRuntime } from "./runtime-config";

export const AUTH_COOKIE = "cafe_pos_admin";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function adminSecret(): string {
  return process.env.ADMIN_PIN?.trim() ?? "";
}

export function isAdminAuthRequired(): boolean {
  if (adminSecret()) return true;
  return isCloudRuntime();
}

export function createAdminSessionToken(): string | null {
  const secret = adminSecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_MS, v: 1 }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  const secret = adminSecret();
  if (!secret || !token) return false;

  // Legacy cookie stored raw PIN
  if (token === secret) return true;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig !== expected) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number };
    return typeof data.exp === "number" && Date.now() < data.exp;
  } catch {
    return false;
  }
}

export function isAdminAuthenticated(cookieValue: string | undefined): boolean {
  if (!isAdminAuthRequired()) return true;
  if (!adminSecret()) return false;
  return verifyAdminSessionToken(cookieValue);
}
