import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, isPublicPath, isValidStaffCookie, staffPinConfigured } from "@/lib/staff-access";

/**
 * クラウド公開時のスタッフ画面保護。
 * STAFF_ACCESS_PIN 未設定（店内LAN運用）のときは何もしない。
 */
export default async function proxy(request: NextRequest) {
  if (!staffPinConfigured()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const ok = await isValidStaffCookie(request.cookies.get(STAFF_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "スタッフ認証が必要です", staffAuthRequired: true }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/staff";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
