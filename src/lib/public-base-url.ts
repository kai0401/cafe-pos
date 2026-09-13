import { buildLanBaseUrl } from "./lan-ip";
import { getRemoteBaseUrl, getRemoteBaseUrlSync } from "./remote-url";
import { isCloudRuntime } from "./runtime-config";

function stripSlash(url: string) {
  return url.replace(/\/$/, "");
}

export function hostnameOf(value: string): string {
  const raw = value.includes("://") ? value : `http://${value}`;
  try {
    return new URL(raw).hostname;
  } catch {
    return value.split(":")[0] ?? value;
  }
}

/** 店舗LAN・ループバック。お客様の携帯回線からは届かない */
export function isPrivateHost(hostOrUrl: string): boolean {
  const host = hostnameOf(hostOrUrl);
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
    return true;
  }
  if (/^192\.168\./.test(host) || /^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (host.endsWith(".local")) return true;
  return false;
}

function envPublicBaseUrl(): string | null {
  const fixed = process.env.PUBLIC_BASE_URL?.trim();
  if (!fixed) return null;
  const url = stripSlash(fixed);
  if (isPrivateHost(url)) return null;
  return url;
}

function requestBaseUrl(requestHost?: string, proto = "https"): string | null {
  if (!requestHost) return null;
  const host = requestHost.split(",")[0]?.trim();
  if (!host || isPrivateHost(host)) return null;
  const scheme = host.includes("localhost") ? "http" : proto;
  return `${scheme}://${host.replace(/\/$/, "")}`;
}

/**
 * お客様QR・管理画面（外出先）用の公開URL。
 * 店舗Wi-Fiの LAN IP は使わない。
 */
export async function getPublicBaseUrlAsync(port = 3000, requestHost?: string): Promise<string> {
  const fixed = envPublicBaseUrl();
  if (fixed) return fixed;

  if (isCloudRuntime()) {
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
    const fromRequest = requestBaseUrl(requestHost);
    if (fromRequest) return fromRequest;
  }

  const remote = await getRemoteBaseUrl();
  if (remote) return remote;

  const fromRequest = requestBaseUrl(requestHost);
  if (fromRequest) return fromRequest;

  const lanBase = buildLanBaseUrl(port);
  if (lanBase) return lanBase;

  if (requestHost) return `http://${requestHost}`;
  return `http://localhost:${port}`;
}

export function getPublicBaseUrl(port = 3000, requestHost?: string): string {
  const fixed = envPublicBaseUrl();
  if (fixed) return fixed;

  if (isCloudRuntime()) {
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
    const fromRequest = requestBaseUrl(requestHost);
    if (fromRequest) return fromRequest;
  }

  const remote = getRemoteBaseUrlSync();
  if (remote) return remote;

  const fromRequest = requestBaseUrl(requestHost);
  if (fromRequest) return fromRequest;

  const lanBase = buildLanBaseUrl(port);
  if (lanBase) return lanBase;

  if (requestHost) return `http://${requestHost}`;
  return `http://localhost:${port}`;
}

/** ウェイター・キッチン（お店のWi-Fi）用 */
export function getStaffBaseUrl(port = 3000): string {
  return buildLanBaseUrl(port) ?? `http://localhost:${port}`;
}

export function getPublicBaseUrlFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "localhost:3000")
    .split(",")[0]
    ?.trim();
  const protoHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader || (isPrivateHost(host) ? "http" : "https");
  const port = Number(host?.split(":")[1] ?? 3000);
  const fromRequest = requestBaseUrl(host, proto);
  if (fromRequest) return fromRequest;
  return getPublicBaseUrl(port, host);
}

export function isBaseUrlFixed(): boolean {
  return Boolean(envPublicBaseUrl() || process.env.VERCEL_URL?.trim());
}

export function isCustomerUrlReachableFromLte(url: string | null | undefined): boolean {
  return Boolean(url && /^https:\/\//i.test(url) && !isPrivateHost(url));
}
