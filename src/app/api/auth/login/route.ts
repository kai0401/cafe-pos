import { NextResponse } from "next/server";

/** ログイン機能は廃止 */
export async function POST() {
  return NextResponse.json({ ok: true, authRequired: false });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
