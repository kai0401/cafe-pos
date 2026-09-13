import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { DataSource, TransactionType } from "@prisma/client";
import { getOpenOrderHistoryRows, getTransactionsForDate } from "@/domain/sales/sales-service";
import { getDefaultStore, prisma } from "@/lib/prisma";
import { formatJSTToday, getDayOfWeekJST } from "@/lib/datetime";
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
  try {
    const store = await getDefaultStore();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const date = searchParams.get("date");
    const closedDays = getClosedDays(store.regularClosedDays);

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "date (YYYY-MM-DD) が必要です" }, { status: 400 });
      }
      const transactions = await getTransactionsForDate(store.id, date);
      return NextResponse.json(transactions);
    }

    const [txs, openOrders] = await Promise.all([
      prisma.salesTransaction.findMany({
        where: {
          storeId: store.id,
          dataSource: { in: [DataSource.SMAREGI, DataSource.OWN_POS] },
          transactionType: TransactionType.SALE,
        },
        select: { businessDate: true, totalAmount: true },
        orderBy: { businessDate: "desc" },
      }),
      getOpenOrderHistoryRows(store.id),
    ]);

    const todayDate = formatJSTToday();
    // 未会計は「いまの売上」として本日に計上（作成日が昨日でも本日に含める）
    const openAsToday = new Date(`${todayDate}T12:00:00+09:00`);

    const historyRows = [
      ...txs.map((tx) => ({ at: tx.businessDate, total: tx.totalAmount, open: false as const })),
      ...openOrders.map((o) => ({
        at: openAsToday,
        total: o.totalAmount,
        open: true as const,
      })),
    ];

    if (month) {
      const dayMap = new Map<string, { count: number; total: number }>();
      for (const row of historyRows) {
        if (monthKey(row.at) !== month) continue;
        const key = dayKey(row.at);
        const cur = dayMap.get(key) ?? { count: 0, total: 0 };
        cur.count++;
        cur.total += row.total;
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
    for (const row of historyRows) {
      const key = monthKey(row.at);
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += row.total;
      map.set(key, cur);
    }

    const todayMonth = todayDate.slice(0, 7);
    if (!map.has(todayMonth)) map.set(todayMonth, { count: 0, total: 0 });

    const months = Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([m, data]) => ({ month: m, count: data.count, total: data.total }));

    const todayAgg = { count: 0, total: 0, openCount: 0, openTotal: 0 };
    for (const row of historyRows) {
      if (dayKey(row.at) !== todayDate) continue;
      todayAgg.count++;
      todayAgg.total += row.total;
      if (row.open) {
        todayAgg.openCount++;
        todayAgg.openTotal += row.total;
      }
    }

    return NextResponse.json({
      today: {
        date: todayDate,
        count: todayAgg.count,
        total: todayAgg.total,
        openCount: todayAgg.openCount,
        openTotal: todayAgg.openTotal,
      },
      months,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取引履歴の取得に失敗しました" },
      { status: 500 },
    );
  }
}
