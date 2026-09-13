/**
 * スタッフ画面の簡易アクセス制御（クラウド公開時用）
 * STAFF_ACCESS_PIN が設定されている場合のみ有効。
 * PIN を一度入力した端末には長期 Cookie を発行し、以後は入力不要。
 * Edge Runtime（proxy.ts）でも動くよう Web Crypto のみ使用。
 */
export const STAFF_COOKIE = "cafe_staff";
export const STAFF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年

export function staffPinConfigured(): boolean {
  return Boolean(process.env.STAFF_ACCESS_PIN && process.env.STAFF_ACCESS_PIN.length >= 4);
}

export async function staffCookieValueFor(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`cafe-pos-staff:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidStaffCookie(value: string | undefined | null): Promise<boolean> {
  if (!value || !staffPinConfigured()) return false;
  const expected = await staffCookieValueFor(process.env.STAFF_ACCESS_PIN as string);
  return value === expected;
}

/** 認証なしで通す公開パス（お客様QR・決済・ヘルス・印刷エージェント・静的） */
const PUBLIC_PREFIXES = [
  "/qr",
  "/staff",
  "/api/qr",
  "/api/payments",
  "/api/product-photos",
  "/api/connect/qr",
  "/api/health",
  "/api/print-agent",
  "/api/ops/heartbeat",
  "/api/auth",
  "/_next",
  "/icons",
  "/favicon.ico",
  "/offline-waiter.html",
  "/print-agent.mjs",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (/^\/(manifest[^/]*\.json|sw-[^/]+\.js|[^/]+\.svg|[^/]+\.png)$/.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
