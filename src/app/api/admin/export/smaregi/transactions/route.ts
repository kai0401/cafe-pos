import { NextResponse } from "next/server";
import { DataSource } from "@prisma/client";
import { getCurrentJstYearMonth, jstMonthRange } from "@/lib/analytics-period";
import { getBusinessDate } from "@/lib/datetime";
import { getDefaultStore } from "@/lib/prisma";
import { buildSmaregiTransactionCsv } from "@/domain/export/smaregi-export";

/**
 * スマレジ「取引明細CSV」互換エクスポート
 * ?month=YYYY-MM（省略時は当月）
 * ?date=YYYY-MM-DD（その営業日のみ）
 * ?dataSource=OWN_POS|SMAREGI|ALL（省略時 ALL）
 */
export async function GET(request: Request) {
  try {
    const store = await getDefaultStore();
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const dateParam = url.searchParams.get("date");
    const sourceParam = (url.searchParams.get("dataSource") || "ALL").toUpperCase();

    let from: Date;
    let to: Date;
    let filename: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const day = getBusinessDate(new Date(`${dateParam}T12:00:00+09:00`));
      from = day;
      to = day;
      filename = `smaregi-transactions-${dateParam}.csv`;
    } else {
      let year: number;
      let month: number;
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        [year, month] = monthParam.split("-").map(Number) as [number, number];
      } else {
        const current = getCurrentJstYearMonth();
        year = current.year;
        month = current.month;
      }
      ({ start: from, end: to } = jstMonthRange(year, month));
      filename = `smaregi-transactions-${year}-${String(month).padStart(2, "0")}.csv`;
    }

    const dataSource =
      sourceParam === "OWN_POS" || sourceParam === "SMAREGI"
        ? (sourceParam as DataSource)
        : "ALL";

    const csv = await buildSmaregiTransactionCsv({
      storeId: store.id,
      from,
      to,
      dataSource,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "エクスポートに失敗しました" },
      { status: 500 },
    );
  }
}
