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

export type TableRow = {
  id: string;
  name: string;
  eatInType: string;
  status: string;
  pendingCount: number;
  itemCount: number;
  orderId: string | null;
};

export function WaiterTablesClient({ initialTables }: { initialTables: TableRow[] }) {
  const router = useRouter();
  const [tables, setTables] = useState<TableRow[]>(initialTables);
  const [guestDialog, setGuestDialog] = useState<{ tableId: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await flushOfflineQueue();
      const res = await fetch("/api/waiter/tables", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("invalid response");
      setTables(data);
      setLoadError(null);
    } catch {
      setLoadError("テーブル情報の取得に失敗しました");
    }
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
    const tableId = guestDialog.tableId;
    setGuestDialog(null);
    router.push(`/waiter/order/${tableId}/categories`);
  }

  const dineIn = tables.filter((t) => t.eatInType === "DINE_IN");
  const takeout = tables.filter((t) => t.eatInType === "TAKEOUT");

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <WaiterHeader title="テーブル一覧" backHref="/waiter" onRefresh={load} />

      {loadError && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {loadError}
          <button type="button" onClick={load} className="ml-2 underline">
            再試行
          </button>
        </div>
      )}

      <SectionLabel>イートイン</SectionLabel>
      {dineIn.length === 0 ? (
        <p className="bg-white px-4 py-3 text-[14px] text-stone-400">テーブルがありません</p>
      ) : (
        dineIn.map((t) => (
          <WaiterRow
            key={t.id}
            label={t.name}
            sub={t.itemCount > 0 ? `${t.itemCount}点注文中` : undefined}
            badge={t.pendingCount > 0 ? `未送信 ${t.pendingCount}` : undefined}
            onClick={() => handleTableClick(t)}
          />
        ))
      )}

      <SectionLabel>テイクアウト</SectionLabel>
      {takeout.length === 0 ? (
        <p className="bg-white px-4 py-3 text-[14px] text-stone-400">テーブルがありません</p>
      ) : (
        takeout.map((t) => (
          <WaiterRow
            key={t.id}
            label={t.name}
            sub={t.itemCount > 0 ? `${t.itemCount}点注文中` : undefined}
            badge={t.pendingCount > 0 ? `未送信 ${t.pendingCount}` : undefined}
            onClick={() => handleTableClick(t)}
          />
        ))
      )}

      {guestDialog && (
        <GuestCountDialog
          onConfirm={confirmGuest}
          onCancel={() => setGuestDialog(null)}
        />
      )}
    </div>
  );
}
