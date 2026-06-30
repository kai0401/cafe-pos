"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog, Toast } from "@/components/waiter/waiter-ui";
import { formatYen } from "@/lib/format";
import { flushOfflineQueue } from "@/lib/offline-queue";

const ORANGE = "#e8912d";
const BLUE = "#2b6cb0";

type Tab = "summary" | "order" | "history";

type TableInfo = { id: string; name: string; eatInType: string };
type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  status: string;
  note: string | null;
  createdAt: string;
};
type Order = {
  id: string;
  customerCount: number;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function elapsedLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}時間${rem}分` : `${hours}時間`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "未送信",
  SENT: "送信中",
  DONE: "提供済",
  SERVED: "提供済",
  CANCELLED: "取消",
};

export function TableOrderApp({ tableId }: { tableId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "summary";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");

  const eatInType = table?.eatInType === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
  const titlePrefix = eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  const totals = useMemo(() => {
    const items = order?.items ?? [];
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const amount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const pending = items.filter((i) => i.status === "PENDING");
    const pendingCount = pending.reduce((s, i) => s + i.quantity, 0);
    return { count, amount, pendingCount };
  }, [order]);

  const load = useCallback(async () => {
    await flushOfflineQueue();
    const [tableRes, orderRes] = await Promise.all([
      fetch(`/api/waiter/tables/${tableId}`),
      fetch(`/api/waiter/orders?tableId=${tableId}`),
    ]);
    const tableData = await tableRes.json();
    setTable(tableData);
    const orderData = await orderRes.json();
    setOrder(orderData?.id ? orderData : null);
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const urlTab = searchParams.get("tab") as Tab | null;
    if (urlTab === "history" || urlTab === "summary") {
      setTab(urlTab);
    }
  }, [searchParams]);

  async function updateGuests(delta: number) {
    if (!order) return;
    const next = Math.max(1, Math.min(20, order.customerCount + delta));
    const res = await fetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateGuests", tableId, customerCount: next }),
    });
    if (res.ok) setOrder(await res.json());
  }

  async function saveMemo() {
    if (!order) return;
    const res = await fetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateMemo", orderId: order.id, note: memoDraft }),
    });
    if (res.ok) {
      setOrder(await res.json());
      setMemoOpen(false);
    }
  }

  async function cancelTransaction() {
    if (!order) return;
    setLoading(true);
    await fetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancelTransaction", orderId: order.id }),
    });
    setLoading(false);
    setShowCancelConfirm(false);
    router.push("/waiter/tables");
  }

  function switchTab(next: Tab) {
    if (next === "order") {
      router.push(`/waiter/order/${tableId}/categories`);
      return;
    }
    setTab(next);
    router.replace(`/waiter/order/${tableId}?tab=${next}`, { scroll: false });
  }

  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#efefef] text-stone-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#efefef] pb-[60px]">
      {/* Header */}
      <header
        className="pt-safe sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between px-3 text-white"
        style={{ backgroundColor: ORANGE }}
      >
        <Link href="/waiter/tables" className="min-w-[56px] text-[15px] leading-none">
          ‹ 戻る
        </Link>
        <h1 className="truncate text-[15px] font-semibold">
          {titlePrefix} : {table.name}
        </h1>
        <button type="button" onClick={load} className="min-w-[56px] text-right text-[18px] leading-none" aria-label="更新">
          ↻
        </button>
      </header>

      {/* Tab content */}
      <div className="flex flex-1 flex-col min-h-0 overflow-auto">
        {tab === "summary" && order && (
          <SummaryTab
            order={order}
            now={now}
            totals={totals}
            onGuests={updateGuests}
            onMemoOpen={() => {
              setMemoDraft(order.note ?? "");
              setMemoOpen(true);
            }}
            onCheckout={() => setToast("会計機能は Phase 3 で実装予定です")}
            onCancel={() => setShowCancelConfirm(true)}
            onPrint={() => setToast("印刷は Phase 4 で実装予定です")}
            onTable={() => router.push("/waiter/tables")}
          />
        )}

        {tab === "summary" && !order && (
          <div className="p-8 text-center text-stone-500">注文がありません</div>
        )}

        {tab === "history" && (
          <HistoryTab items={order?.items ?? []} />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="pb-safe fixed bottom-0 left-0 right-0 z-30 mx-auto flex w-full max-w-[var(--waiter-width)] border-t border-stone-300 bg-white">
        {(
          [
            { id: "summary" as Tab, label: "概要", icon: "👥" },
            { id: "order" as Tab, label: "追加注文", icon: "📖" },
            { id: "history" as Tab, label: "注文履歴", icon: "📋" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className="flex flex-1 flex-col items-center py-2 text-[11px]"
            style={{ color: tab === t.id ? ORANGE : "#888" }}
          >
            <span className="text-[20px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {memoOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold">メモ</h2>
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              className="h-32 w-full rounded-lg border border-stone-300 p-3 text-[16px]"
              placeholder="メモを入力"
            />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setMemoOpen(false)} className="flex-1 rounded-lg border py-3">
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveMemo}
                className="flex-1 rounded-lg py-3 font-semibold text-white"
                style={{ backgroundColor: ORANGE }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          title="取引を中止しますか？"
          confirmLabel="中止"
          onConfirm={cancelTransaction}
          onCancel={() => setShowCancelConfirm(false)}
        >
          <p className="text-[15px] text-stone-600">未会計の注文がすべて取消されます。</p>
        </ConfirmDialog>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

function SummaryTab({
  order,
  now,
  totals,
  onGuests,
  onMemoOpen,
  onCheckout,
  onCancel,
  onPrint,
  onTable,
}: {
  order: Order;
  now: number;
  totals: { count: number; amount: number };
  onGuests: (delta: number) => void;
  onMemoOpen: () => void;
  onCheckout: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onTable: () => void;
}) {
  void now;
  const rows = [
    { label: "入店時間", value: formatDateTime(order.createdAt), action: null },
    { label: "経過時間", value: elapsedLabel(order.createdAt), action: null },
    { label: "スタッフ", value: "管理者", action: "chevron" as const },
    { label: "人数", value: `${order.customerCount}人`, action: "guests" as const },
    { label: "客層", value: "未設定", action: "chevron" as const },
    {
      label: "合計",
      value: `${totals.count}点`,
      sub: formatYen(totals.amount),
      action: "chevron" as const,
    },
    { label: "メモ", value: order.note || "", action: "chevron" as const, onClick: onMemoOpen },
  ];

  return (
    <>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-[16px]"
          onClick={row.onClick}
          role={row.onClick ? "button" : undefined}
        >
          <span className="text-[16px] text-stone-700">{row.label}</span>
          <div className="flex items-center gap-2">
            {row.action === "guests" ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onGuests(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-[20px]"
                >
                  −
                </button>
                <span className="min-w-[40px] text-center text-[16px]">{row.value}</span>
                <button
                  type="button"
                  onClick={() => onGuests(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-[20px]"
                >
                  ＋
                </button>
              </div>
            ) : (
              <>
                <div className="text-right">
                  <div className="text-[16px] text-stone-900">{row.value}</div>
                  {"sub" in row && row.sub && (
                    <div className="text-[15px] font-bold" style={{ color: BLUE }}>
                      {row.sub}
                    </div>
                  )}
                </div>
                {row.action === "chevron" && (
                  <span className="text-[18px] text-stone-300">›</span>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      <div className="p-4">
        <button
          type="button"
          onClick={onCheckout}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-4 text-[17px] font-semibold text-white"
          style={{ backgroundColor: BLUE }}
        >
          ✓ 取引完了
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px bg-stone-200 px-0">
        {[
          { label: "取引中止", icon: "🚫", onClick: onCancel },
          { label: "印刷", icon: "🖨", onClick: onPrint },
          { label: "テーブル", icon: "🪑", onClick: onTable },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            className="flex flex-col items-center bg-white py-4 text-[13px] text-stone-700 active:bg-stone-50"
          >
            <span className="mb-1 text-[22px]">{btn.icon}</span>
            {btn.label}
          </button>
        ))}
      </div>
    </>
  );
}

function HistoryTab({ items }: { items: OrderItem[] }) {
  if (items.length === 0) {
    return <p className="p-8 text-center text-stone-400">注文履歴がありません</p>;
  }

  return (
    <div>
      {[...items].reverse().map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-[14px]"
        >
          <div>
            <p className="text-[16px] text-stone-900">
              {item.productName}
              {item.quantity > 1 && ` ×${item.quantity}`}
            </p>
            <p className="text-[12px] text-stone-400">
              {formatDateTime(item.createdAt)} · {STATUS_LABEL[item.status] ?? item.status}
            </p>
          </div>
          <span className="text-[15px] font-medium" style={{ color: BLUE }}>
            {formatYen(item.unitPrice * item.quantity)}
          </span>
        </div>
      ))}
    </div>
  );
}
