import { NextResponse } from "next/server";
import { buildLanBaseUrl, getLanIp } from "@/lib/lan-ip";
import {
  getPublicBaseUrlAsync,
  getStaffBaseUrl,
  isBaseUrlFixed,
  isCustomerUrlReachableFromLte,
} from "@/lib/public-base-url";
import { getRemoteUrlInfo } from "@/lib/remote-url";
import { isCloudRuntime } from "@/lib/runtime-config";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const port = Number((host.split(",")[0] ?? "").split(":")[1] ?? process.env.PORT ?? 3000);
  const cloud = isCloudRuntime();
  const lanIp = cloud ? null : getLanIp();
  const remote = cloud ? null : await getRemoteUrlInfo();
  const lanUrl = cloud ? null : buildLanBaseUrl(port) ?? (lanIp ? `http://${lanIp}:${port}` : null);
  const publicUrl = await getPublicBaseUrlAsync(port, host.split(",")[0]?.trim());
  const staffUrl = cloud ? publicUrl : getStaffBaseUrl(port);

  return NextResponse.json({
    cloud,
    mode: cloud ? "cloud" : remote?.url ? "hybrid" : lanIp ? "lan" : "local",
    lanIp,
    port,
    baseUrl: publicUrl,
    lanUrl,
    remoteUrl: remote?.url ?? null,
    remoteUpdatedAt: remote?.updatedAt ?? null,
    remoteActive: Boolean(remote?.url),
    shopServerRequired: !cloud,
    baseUrlFixed: isBaseUrlFixed() || isCustomerUrlReachableFromLte(publicUrl),
    lteReady: cloud || isCustomerUrlReachableFromLte(publicUrl),
    waiterUrl: `${staffUrl}/waiter`,
    tablesUrl: `${staffUrl}/waiter/tables`,
    kitchenUrl: `${staffUrl}/kitchen`,
    kitchenOpenUrl: `${staffUrl}/kitchen/open`,
    kitchenInstallUrl: `${staffUrl}/kitchen/install`,
    kitchenConnectUrl: `${staffUrl}/kitchen/connect`,
    connectUrl: `${staffUrl}/waiter/connect`,
    adminUrl: `${publicUrl}/admin`,
    qrBaseUrl: `${publicUrl}/qr`,
    isLan: Boolean(lanIp),
  });
}
