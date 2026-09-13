import { NextResponse } from "next/server";
import {
  STAFF_COOKIE,
  STAFF_COOKIE_MAX_AGE,
  staffCookieValueFor,
  staffPinConfigured,
} from "@/lib/staff-access";

export const dynamic = "force-dynamic";

/** GET: PIN 認証が必要かどうか */
export async function GET() {
  return NextResponse.json({ required: staffPinConfigured() });
}

/** POST { pin }: 正しければ長期 Cookie を発行 */
export async function POST(request: Request) {
  if (!staffPinConfigured()) {
    return NextResponse.json({ ok: true, required: false });
  }
  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const pin = (body?.pin ?? "").trim();
  if (!pin || pin !== process.env.STAFF_ACCESS_PIN) {
    // 総当たり対策として少し待つ
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "PINが違います" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, await staffCookieValueFor(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STAFF_COOKIE_MAX_AGE,
  });
  return res;
}

/** DELETE: この端末の認証を解除 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
