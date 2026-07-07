import { NextResponse } from "next/server";
import { getTransactionsForDate } from "@/domain/sales/sales-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
  }
  const store = await getDefaultStore();
  const transactions = await getTransactionsForDate(store.id, date);
  return NextResponse.json(transactions);
}
