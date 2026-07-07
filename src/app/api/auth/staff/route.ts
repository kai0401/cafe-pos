import { NextResponse } from "next/server";
import {
  createStaffSessionToken,
  isStaffAuthRequired,
  STAFF_COOKIE,
  verifyStaffPin,
} from "@/lib/staff-auth";

export async function POST(request: Request) {
  try {
    if (!isStaffAuthRequired()) {
      return NextResponse.json({ ok: true, authRequired: false });
    }

    const { pin } = await request.json();
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PINを入力してください" }, { status: 400 });
    }

    if (!verifyStaffPin(pin)) {
      return NextResponse.json({ error: "PINが正しくありません" }, { status: 401 });
    }

    const token = createStaffSessionToken();
    if (!token) {
      return NextResponse.json({ error: "STAFF_PIN が未設定です" }, { status: 503 });
    }

    const res = NextResponse.json({ ok: true, authRequired: true });
    res.cookies.set(STAFF_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "認証エラー" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ authRequired: isStaffAuthRequired() });
}
