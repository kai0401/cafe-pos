import { NextResponse } from "next/server";
import { getTablesWithOrders } from "@/domain/order/order-service";
import { ensureWaiterTables } from "@/lib/waiter-setup";

export async function GET() {
  try {
    const store = await ensureWaiterTables();
    const tables = await getTablesWithOrders(store.id);
    return NextResponse.json(tables);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テーブル取得エラー" },
      { status: 500 },
    );
  }
}
