import { NextResponse } from "next/server";
import { isCloudRuntime } from "@/lib/runtime-config";

/** ログイン機能は廃止 */
export async function POST() {
  return NextResponse.json({ ok: true, authRequired: false });
}

export async function GET() {
  return NextResponse.json({
    authRequired: false,
    authenticated: true,
    cloud: isCloudRuntime(),
  });
}
