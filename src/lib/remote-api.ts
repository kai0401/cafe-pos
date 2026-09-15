/**
 * 遠隔ダッシュボード用 fetch。
 * Vercel などクラウドホストでは店舗 Pi（トンネル）へプロキシし、本番会計DBを読む。
 * 店内LAN（Pi IP）では同一オリジンのまま。
 */
export function shouldUseShopProxy(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  }
  return process.env.VERCEL === "1" || process.env.CLOUD_RUNTIME === "1";
}

export async function remoteFetch(path: string, init?: RequestInit): Promise<Response> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!shouldUseShopProxy()) {
    return fetch(clean, { ...init, cache: "no-store" });
  }
  if (!clean.startsWith("/api/")) {
    throw new Error("remoteFetch は /api/* のみ対応です");
  }
  const withoutApi = clean.slice("/api/".length);
  return fetch(`/api/remote/shop/${withoutApi}`, { ...init, cache: "no-store" });
}
