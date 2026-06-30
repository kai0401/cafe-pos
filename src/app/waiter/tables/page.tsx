import { getTablesWithOrders } from "@/domain/order/order-service";
import { ensureWaiterSetup } from "@/lib/waiter-setup";
import { WaiterTablesClient } from "./tables-client";

export const dynamic = "force-dynamic";

export default async function WaiterTablesPage() {
  const store = await ensureWaiterSetup();
  const tables = await getTablesWithOrders(store.id);
  return <WaiterTablesClient initialTables={tables} />;
}
