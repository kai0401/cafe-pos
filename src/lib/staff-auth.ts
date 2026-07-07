import crypto from "crypto";
import { isCloudRuntime } from "./runtime-config";

export const STAFF_COOKIE = "cafe_pos_staff";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function staffSecret(): string {
  return process.env.STAFF_PIN?.trim() ?? "";
}

/** STAFF_PIN 設定時、またはクラウド本番ではスタッフ認証必須 */
export function isStaffAuthRequired(): boolean {
  if (staffSecret()) return true;
  return isCloudRuntime();
}

export function createStaffSessionToken(): string | null {
  const secret = staffSecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_MS, v: 1 }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyStaffSessionToken(token: string | undefined): boolean {
  const secret = staffSecret();
  if (!secret || !token) return false;

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

export function isStaffAuthenticated(cookieValue: string | undefined): boolean {
  if (!isStaffAuthRequired()) return true;
  if (!staffSecret()) return false;
  return verifyStaffSessionToken(cookieValue);
}

export function verifyStaffPin(pin: string): boolean {
  const secret = staffSecret();
  return Boolean(secret && pin === secret);
}
