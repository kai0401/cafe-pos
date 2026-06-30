"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GuestCountDialog,
  SectionLabel,
  WaiterHeader,
  WaiterRow,
} from "@/components/waiter/waiter-ui";
import { flushOfflineQueue } from "@/lib/offline-queue";

type TableRow = {
  id: string;
  name: string;
  eatInType: string;
  status: string;
  pendingCount: number;
  itemCount: number;
  orderId: string | null;
};

export default function WaiterTablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [guestDialog, setGuestDialog] = useState<{ tableId: string; name: string } | null>(null);

  const load = useCallback(async () => {
    await flushOfflineQueue();
    const res = await fetch("/api/waiter/tables");
    setTables(await res.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleTableClick(table: TableRow) {
    if (table.orderId) {
      router.push(`/waiter/order/${table.id}/categories`);
      return;
    }
    setGuestDialog({ tableId: table.id, name: table.name });
  }

  async function confirmGuest(count: number) {
    if (!guestDialog) return;
    await fetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", tableId: guestDialog.tableId, customerCount: count }),
    });
    setGuestDialog(null);
    router.push(`/waiter/order/${guestDialog.tableId}/categories`);
  }

  const dineIn = tables.filter((t) => t.eatInType === "DINE_IN");
  const takeout = tables.filter((t) => t.eatInType === "TAKEOUT");

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <WaiterHeader title="テーブル一覧" backHref="/waiter" onRefresh={load} />
      <SectionLabel>イートイン</SectionLabel>
      {dineIn.map((t) => (
        <WaiterRow
          key={t.id}
          label={t.name}
          sub={t.itemCount > 0 ? `${t.itemCount}点注文中` : undefined}
          badge={t.pendingCount > 0 ? `未送信 ${t.pendingCount}` : undefined}
          onClick={() => handleTableClick(t)}
        />
      ))}
      <SectionLabel>テイクアウト</SectionLabel>
      {takeout.map((t) => (
        <WaiterRow
          key={t.id}
          label={t.name}
          sub={t.itemCount > 0 ? `${t.itemCount}点注文中` : undefined}
          badge={t.pendingCount > 0 ? `未送信 ${t.pendingCount}` : undefined}
          onClick={() => handleTableClick(t)}
        />
      ))}

      {guestDialog && (
        <GuestCountDialog
          onConfirm={confirmGuest}
          onCancel={() => setGuestDialog(null)}
        />
      )}
    </div>
  );
}
