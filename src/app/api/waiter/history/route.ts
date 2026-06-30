import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { DataSource, TransactionType } from "@prisma/client";
import { getDefaultStore, prisma } from "@/lib/prisma";
import { getDayOfWeekJST } from "@/lib/datetime";
import { getClosedDays } from "@/lib/store-config";

const TZ = "Asia/Tokyo";

function monthKey(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM");
}

function dayKey(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = last; d >= 1; d--) {
    days.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function isClosedDay(dateStr: string, closedDays: number[]): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return closedDays.includes(getDayOfWeekJST(date));
}

export async function GET(request: Request) {
  const store = await getDefaultStore();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const closedDays = getClosedDays(store.regularClosedDays);

  const txs = await prisma.salesTransaction.findMany({
    where: {
      storeId: store.id,
      dataSource: DataSource.SMAREGI,
      transactionType: TransactionType.SALE,
    },
    select: { businessDate: true, totalAmount: true },
    orderBy: { businessDate: "desc" },
  });

  if (month) {
    const dayMap = new Map<string, { count: number; total: number }>();
    for (const tx of txs) {
      if (monthKey(tx.businessDate) !== month) continue;
      const key = dayKey(tx.businessDate);
      const cur = dayMap.get(key) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += tx.totalAmount;
      dayMap.set(key, cur);
    }

    const rows = daysInMonth(month).map((date) => {
      const data = dayMap.get(date) ?? { count: 0, total: 0 };
      return {
        date,
        count: data.count,
        total: data.total,
        isClosedDay: isClosedDay(date, closedDays),
      };
    });

    const summary = rows.reduce(
      (acc, r) => ({ count: acc.count + r.count, total: acc.total + r.total }),
      { count: 0, total: 0 },
    );

    return NextResponse.json({ month, summary, days: rows });
  }

  const map = new Map<string, { count: number; total: number }>();
  for (const tx of txs) {
    const key = monthKey(tx.businessDate);
    const cur = map.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += tx.totalAmount;
    map.set(key, cur);
  }

  const months = Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([m, data]) => ({ month: m, count: data.count, total: data.total }));

  return NextResponse.json(months);
}
