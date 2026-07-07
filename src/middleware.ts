import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_COOKIE,
  isAdminAuthenticated,
  isAdminAuthRequired,
} from "@/lib/admin-auth";
import {
  STAFF_COOKIE,
  isStaffAuthenticated,
  isStaffAuthRequired,
} from "@/lib/staff-auth";

const ADMIN_SENSITIVE_API_PREFIXES = [
  "/api/closing",
  "/api/imports",
  "/api/analytics",
  "/api/reports",
  "/api/admin/export",
];

const STAFF_MUTATION_PREFIXES = [
  "/api/waiter/orders",
  "/api/waiter/products",
  "/api/kitchen/tickets",
  "/api/payments/stores",
  "/api/sales/refund",
  "/api/printer/bill",
  "/api/printer/test",
];

function isAdminSensitiveApi(pathname: string): boolean {
  return ADMIN_SENSITIVE_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isStaffMutationApi(pathname: string, method: string): boolean {
  if (method === "GET" || method === "HEAD") return false;
  if (pathname === "/api/printer" && method === "POST") return true;
  return STAFF_MUTATION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function unauthorizedApi(message = "認証が必要です") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function configErrorApi(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const adminAuth = request.cookies.get(AUTH_COOKIE)?.value;
  const staffAuth = request.cookies.get(STAFF_COOKIE)?.value;

  if (
    pathname === "/admin/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/waiter/login" ||
    pathname === "/api/auth/staff"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  if (isAdminSensitiveApi(pathname) || pathname === "/api/sales/day") {
    if (isAdminAuthRequired() && !adminAuth) {
      return configErrorApi("ADMIN_PIN が未設定です。環境変数を設定してください");
    }
    if (!isAdminAuthenticated(adminAuth)) return unauthorizedApi();
    return NextResponse.next();
  }

  if (isStaffMutationApi(pathname, method)) {
    if (isStaffAuthRequired() && !process.env.STAFF_PIN?.trim()) {
      return configErrorApi("STAFF_PIN が未設定です。環境変数を設定してください");
    }
    if (!isStaffAuthenticated(staffAuth)) {
      return unauthorizedApi("スタッフ認証が必要です");
    }
    return NextResponse.next();
  }

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute) {
    if (isAdminAuthRequired() && !process.env.ADMIN_PIN?.trim()) {
      if (pathname.startsWith("/api/")) {
        return configErrorApi("ADMIN_PIN が未設定です");
      }
      return new NextResponse("ADMIN_PIN が未設定です", { status: 503 });
    }
    if (!isAdminAuthenticated(adminAuth)) {
      if (pathname.startsWith("/api/")) return unauthorizedApi();
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/closing",
    "/api/closing/:path*",
    "/api/imports",
    "/api/imports/:path*",
    "/api/analytics/:path*",
    "/api/reports/:path*",
    "/api/sales/:path*",
    "/api/waiter/orders",
    "/api/waiter/products",
    "/api/kitchen/tickets",
    "/api/payments/stores",
    "/api/payments/stores/:path*",
    "/api/printer",
    "/api/printer/:path*",
  ],
};
