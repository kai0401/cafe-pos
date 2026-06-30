import { NextResponse } from "next/server";
import { getTablesWithOrders } from "@/domain/order/order-service";
import { ensureWaiterSetup } from "@/lib/waiter-setup";

export async function GET() {
  const store = await ensureWaiterSetup();
  const tables = await getTablesWithOrders(store.id);
  return NextResponse.json(tables);
}
