import { NextResponse } from "next/server";
import { getFreshShopPublicUrl } from "@/domain/ops/shop-bridge";
import { isCloudRuntime } from "@/lib/runtime-config";

/** 遠隔ダッシュボードが店舗 Pi へ転送してよい API（読み取り専用） */
const ALLOWED_PREFIXES = [
  "/api/waiter/history",
  "/api/ops/snapshot",
  "/api/analytics/daily",
  "/api/analytics/summary",
  "/api/reports/monthly",
  "/api/health",
] as const;

function isAllowed(pathname: string): boolean {
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * クラウド → 店舗 Pi（トンネル）へ読み取り専用プロキシ。
 * 例: GET /api/remote/shop/waiter/history?date=2026-09-14
 *   → GET {shopPublicUrl}/api/waiter/history?date=2026-09-14
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!isCloudRuntime()) {
    return NextResponse.json(
      { error: "このプロキシはクラウドからのみ使います" },
      { status: 400 },
    );
  }

  const { path: parts } = await context.params;
  const search = new URL(request.url).search;
  const shopPath = `/api/${(parts ?? []).join("/")}${search}`;
  const pathname = shopPath.split("?")[0] ?? shopPath;

  if (!isAllowed(pathname)) {
    return NextResponse.json({ error: "許可されていないパスです" }, { status: 403 });
  }

  const bridge = await getFreshShopPublicUrl();
  if (!bridge.url) {
    return NextResponse.json(
      {
        error: "店舗サーバーに接続できません。Pi のトンネル／心拍を確認してください。",
        stale: bridge.stale,
        ageSeconds: bridge.ageSeconds,
      },
      { status: 503 },
    );
  }

  const dest = `${bridge.url}${shopPath}`;
  try {
    const res = await fetch(dest, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "店舗への転送に失敗しました" },
      { status: 502 },
    );
  }
}
