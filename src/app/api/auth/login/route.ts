import { NextResponse } from "next/server";
import { AUTH_COOKIE, createAdminSessionToken } from "@/lib/admin-auth";

const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const pin = process.env.ADMIN_PIN?.trim();
  if (!pin) {
    return NextResponse.json({ error: "ADMIN_PIN が設定されていません" }, { status: 500 });
  }

  const body = await request.json();
  if (body.pin !== pin) {
    return NextResponse.json({ error: "PINが正しくありません" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json({ error: "セッション作成に失敗しました" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return res;
}
