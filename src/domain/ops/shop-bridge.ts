import { prisma } from "@/lib/prisma";
import { isPrivateHost } from "@/lib/public-base-url";

/** 心拍がこの秒数より古いとトンネル先を使わない */
const MAX_AGE_SECONDS = 300;

type HeartbeatPayload = {
  shopPublicUrl?: string | null;
  remoteUrl?: string | null;
};

function normalizePublicUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const url = raw.trim().replace(/\/$/, "");
  if (!/^https:\/\//i.test(url)) return null;
  if (isPrivateHost(url)) return null;
  return url;
}

/** クラウド側: 店舗 Pi のお客様向け公開URL（トンネル）を心拍から取得 */
export async function getFreshShopPublicUrl(): Promise<{
  url: string | null;
  ageSeconds: number | null;
  stale: boolean;
}> {
  try {
    const hb = await prisma.opsHeartbeat.findUnique({ where: { id: "shop" } });
    if (!hb) return { url: null, ageSeconds: null, stale: true };
    const ageSeconds = Math.round((Date.now() - hb.receivedAt.getTime()) / 1000);
    const payload = hb.payload as HeartbeatPayload;
    const url = normalizePublicUrl(payload.shopPublicUrl) ?? normalizePublicUrl(payload.remoteUrl);
    const stale = ageSeconds > MAX_AGE_SECONDS || !url;
    return { url: stale ? null : url, ageSeconds, stale };
  } catch {
    return { url: null, ageSeconds: null, stale: true };
  }
}

export function buildShopQrBridgeUrl(
  shopBase: string,
  tableId: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) q.set(key, value);
    else if (Array.isArray(value) && value[0]) q.set(key, value[0]);
  }
  const qs = q.toString();
  return `${shopBase.replace(/\/$/, "")}/qr/${encodeURIComponent(tableId)}${qs ? `?${qs}` : ""}`;
}
