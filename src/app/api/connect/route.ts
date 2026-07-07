import { NextResponse } from "next/server";
import { buildLanBaseUrl, getLanIp } from "@/lib/lan-ip";
import { getPublicBaseUrlAsync, isBaseUrlFixed } from "@/lib/public-base-url";
import { getRemoteUrlInfo } from "@/lib/remote-url";
import { isCloudRuntime } from "@/lib/runtime-config";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const port = Number(host.split(":")[1] ?? 3000);
  const cloud = isCloudRuntime();
  const lanIp = cloud ? null : getLanIp();
  const remote = cloud ? null : await getRemoteUrlInfo();
  const lanUrl = cloud ? null : buildLanBaseUrl(port) ?? (lanIp ? `http://${lanIp}:${port}` : null);
  const base = await getPublicBaseUrlAsync(port, host);

  return NextResponse.json({
    cloud,
    mode: cloud ? "cloud" : remote?.url ? "tunnel" : lanIp ? "lan" : "local",
    lanIp,
    port,
    baseUrl: base,
    lanUrl,
    remoteUrl: remote?.url ?? null,
    remoteUpdatedAt: remote?.updatedAt ?? null,
    remoteActive: Boolean(remote?.url),
    shopServerRequired: !cloud,
    baseUrlFixed: isBaseUrlFixed() || Boolean(remote?.url),
    waiterUrl: `${base}/waiter`,
    tablesUrl: `${base}/waiter/tables`,
    kitchenUrl: `${base}/kitchen`,
    kitchenOpenUrl: `${base}/kitchen/open`,
    kitchenInstallUrl: `${base}/kitchen/install`,
    kitchenConnectUrl: `${base}/kitchen/connect`,
    connectUrl: `${base}/waiter/connect`,
    qrBaseUrl: `${base}/qr`,
    isLan: Boolean(lanIp),
  });
}
