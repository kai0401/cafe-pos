import { NextResponse } from "next/server";
import { DataSource } from "@prisma/client";
import { getDefaultStore, prisma } from "@/lib/prisma";
import { getRemoteUrlInfo } from "@/lib/remote-url";
import { buildLanBaseUrl, getLanIp } from "@/lib/lan-ip";
import {
  getPublicBaseUrlAsync,
  isCustomerUrlReachableFromLte,
} from "@/lib/public-base-url";
import { isCloudRuntime } from "@/lib/runtime-config";

export async function GET() {
  const store = await getDefaultStore();
  const [smaregi, ownPos, products, daily] = await Promise.all([
    prisma.salesTransaction.aggregate({
      where: { storeId: store.id, dataSource: DataSource.SMAREGI },
      _count: true,
      _sum: { totalAmount: true },
      _min: { transactionAt: true },
      _max: { transactionAt: true },
    }),
    prisma.salesTransaction.count({
      where: { storeId: store.id, dataSource: DataSource.OWN_POS },
    }),
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.salesDailySummary.count({
      where: { storeId: store.id, dataSource: DataSource.SMAREGI },
    }),
  ]);

  const cloud = isCloudRuntime();
  const publicUrl = await getPublicBaseUrlAsync();
  const remote = cloud ? null : await getRemoteUrlInfo();
  const lanIp = cloud ? null : getLanIp();
  const lanUrl = cloud ? null : buildLanBaseUrl(Number(process.env.PORT ?? 3000));
  const publicAdmin =
    cloud || isCustomerUrlReachableFromLte(publicUrl)
      ? `${publicUrl}/admin`
      : remote?.url
        ? `${remote.url}/admin`
        : null;

  return NextResponse.json({
    storeName: store.name,
    products,
    smaregi: {
      transactions: smaregi._count,
      totalAmount: smaregi._sum.totalAmount ?? 0,
      from: smaregi._min.transactionAt,
      to: smaregi._max.transactionAt,
      dailySummaries: daily,
    },
    ownPosTransactions: ownPos,
    access: {
      cloud,
      lanAdminUrl: lanUrl ? `${lanUrl}/admin` : lanIp ? `http://${lanIp}:3000/admin` : null,
      publicAdminUrl: publicAdmin,
      lteReady: cloud || isCustomerUrlReachableFromLte(publicUrl) || isCustomerUrlReachableFromLte(remote?.url),
    },
  });
}
