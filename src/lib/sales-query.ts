import { DataSource } from "@prisma/client";
import { getHourJST } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { buildSalesTransactionWhere } from "@/lib/sales-data-mode";

export type DailySalesRow = {
  businessDate: Date;
  netSales: number;
  grossSales: number;
  customerCount: number;
  orderCount: number;
  itemCount: number;
  dineInSales: number;
  takeoutSales: number;
  avgSpend: number;
};

export async function loadDailySalesFromTransactions(
  storeId: string,
  dataSources: DataSource[],
): Promise<DailySalesRow[]> {
  const transactions = await prisma.salesTransaction.findMany({
    where: await buildSalesTransactionWhere(storeId, dataSources),
    select: {
      businessDate: true,
      totalAmount: true,
      customerCount: true,
      eatInType: true,
    },
    orderBy: { businessDate: "asc" },
  });

  const map = new Map<string, DailySalesRow>();

  for (const tx of transactions) {
    const key = tx.businessDate.toISOString().slice(0, 10);
    let row = map.get(key);
    if (!row) {
      row = {
        businessDate: new Date(key),
        netSales: 0,
        grossSales: 0,
        customerCount: 0,
        orderCount: 0,
        itemCount: 0,
        dineInSales: 0,
        takeoutSales: 0,
        avgSpend: 0,
      };
      map.set(key, row);
    }
    row.netSales += tx.totalAmount;
    row.grossSales += tx.totalAmount;
    row.customerCount += tx.customerCount;
    row.orderCount += 1;
    if (tx.eatInType === "TAKEOUT") row.takeoutSales += tx.totalAmount;
    else row.dineInSales += tx.totalAmount;
  }

  for (const row of map.values()) {
    row.avgSpend =
      row.customerCount > 0 ? Math.round(row.netSales / row.customerCount) : 0;
  }

  return Array.from(map.values()).sort(
    (a, b) => a.businessDate.getTime() - b.businessDate.getTime(),
  );
}

export async function loadHourlySalesFromTransactions(
  storeId: string,
  dataSources: DataSource[],
  startDate: Date,
  endDate: Date,
  openTime: string,
  closeTime: string,
  businessHoursOnly: boolean,
) {
  const transactions = await prisma.salesTransaction.findMany({
    where: {
      ...(await buildSalesTransactionWhere(storeId, dataSources)),
      businessDate: { gte: startDate, lte: endDate },
    },
    select: {
      transactionAt: true,
      totalAmount: true,
      customerCount: true,
    },
  });

  const [openH] = openTime.split(":").map(Number);
  const [closeH] = closeTime.split(":").map(Number);

  const hourMap = new Map<number, { sales: number; orders: number; customers: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { sales: 0, orders: 0, customers: 0 });
  }

  for (const tx of transactions) {
    const hour = getHourJST(tx.transactionAt);
    if (businessHoursOnly && (hour < openH! || hour >= closeH!)) continue;
    const current = hourMap.get(hour)!;
    current.sales += tx.totalAmount;
    current.orders += 1;
    current.customers += tx.customerCount;
  }

  return Array.from(hourMap.entries())
    .filter(([hour]) => !businessHoursOnly || (hour >= openH! && hour < closeH!))
    .map(([hour, data]) => ({
      hour,
      label: `${hour}:00`,
      ...data,
      band:
        hour < 12
          ? "オープン"
          : hour < 14
            ? "ランチ"
            : hour < 16
              ? "カフェタイム"
              : hour < 18
                ? "クローズ前"
                : "営業時間外",
    }));
}
