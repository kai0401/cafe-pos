import { NextResponse } from "next/server";
import { formatJSTToday } from "@/lib/datetime";
import { getDefaultStore } from "@/lib/prisma";
import { buildSmaregiProductCsv } from "@/domain/export/smaregi-export";

/** スマレジ「商品マスターCSV」互換エクスポート */
export async function GET() {
  try {
    const store = await getDefaultStore();
    const csv = await buildSmaregiProductCsv(store.id);
    const filename = `smaregi-products-${formatJSTToday()}.csv`;

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
