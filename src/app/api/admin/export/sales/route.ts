import { NextResponse } from "next/server";
import { getCurrentJstYearMonth, jstMonthRange } from "@/lib/analytics-period";
import { getDefaultStore, prisma } from "@/lib/prisma";

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: Request) {
  try {
    const store = await getDefaultStore();
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");

    let year: number;
    let month: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split("-").map(Number) as [number, number];
    } else {
      const current = getCurrentJstYearMonth();
      year = current.year;
      month = current.month;
    }

    const { start, end } = jstMonthRange(year, month);
    const rows = await prisma.salesTransaction.findMany({
      where: {
        storeId: store.id,
        businessDate: { gte: start, lte: end },
      },
      orderBy: [{ businessDate: "asc" }, { transactionAt: "asc" }],
      include: {
        items: true,
        payments: true,
      },
    });

    const header = [
      "businessDate",
      "transactionType",
      "paymentMethod",
      "totalAmount",
      "discountAmount",
      "consumptionTax",
      "customerCount",
      "itemName",
      "quantity",
      "unitPrice",
      "lineAmount",
    ];

    const lines = [header.join(",")];
    for (const tx of rows) {
      const paymentMethod = tx.payments.map((p) => p.method).join("+") || "";
      if (tx.items.length === 0) {
        lines.push(
          [
            tx.businessDate.toISOString().slice(0, 10),
            tx.transactionType,
            paymentMethod,
            tx.totalAmount,
            tx.discountAmount,
            tx.consumptionTax,
            tx.customerCount,
            "",
            "",
            "",
            "",
          ]
            .map(csvEscape)
            .join(","),
        );
        continue;
      }

      for (const item of tx.items) {
        lines.push(
          [
            tx.businessDate.toISOString().slice(0, 10),
            tx.transactionType,
            paymentMethod,
            tx.totalAmount,
            tx.discountAmount,
            tx.consumptionTax,
            tx.customerCount,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.totalAmount,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    }

    const csv = `\uFEFF${lines.join("\n")}`;
    const filename = `sales-${year}-${String(month).padStart(2, "0")}.csv`;

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
