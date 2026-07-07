import { buildLanBaseUrl } from "./lan-ip";
import { getRemoteBaseUrl } from "./remote-url";
import { isCloudRuntime } from "./runtime-config";

/**
 * スタッフ・お客様がアクセスする公開URL。
 * クラウド本番: PUBLIC_BASE_URL または VERCEL_URL（https）
 * トンネル常駐: .shop-remote-url.json（https・どこでも接続）
 * ローカル開発: LAN IP または localhost
 */
export async function getPublicBaseUrlAsync(port = 3000, requestHost?: string): Promise<string> {
  const fixed = process.env.PUBLIC_BASE_URL?.trim();
  if (fixed) return fixed.replace(/\/$/, "");

  if (isCloudRuntime()) {
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
    if (requestHost) {
      const proto = requestHost.includes("localhost") ? "http" : "https";
      return `${proto}://${requestHost}`;
    }
  }

  // ローカル店舗サーバー: cloudflared トンネル（Mac 常駐時のみ）
  const remote = await getRemoteBaseUrl();
  if (remote) return remote;

  const lanBase = buildLanBaseUrl(port);
  if (lanBase) return lanBase;

  if (requestHost) {
    return `http://${requestHost}`;
  }

  return `http://localhost:${port}`;
}

export function getPublicBaseUrl(port = 3000, requestHost?: string): string {
  const fixed = process.env.PUBLIC_BASE_URL?.trim();
  if (fixed) return fixed.replace(/\/$/, "");

  if (isCloudRuntime()) {
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
    if (requestHost) {
      const proto = requestHost.includes("localhost") ? "http" : "https";
      return `${proto}://${requestHost}`;
    }
  }

  const lanBase = buildLanBaseUrl(port);
  if (lanBase) return lanBase;

  if (requestHost) {
    return `http://${requestHost}`;
  }

  return `http://localhost:${port}`;
}

export function getPublicBaseUrlFromRequest(request: Request): string {
  const host = request.headers.get("host") ?? "localhost:3000";
  const port = Number(host.split(":")[1] ?? 3000);
  return getPublicBaseUrl(port, host);
}

export function isBaseUrlFixed(): boolean {
  return Boolean(process.env.PUBLIC_BASE_URL?.trim() || process.env.VERCEL_URL?.trim());
}
