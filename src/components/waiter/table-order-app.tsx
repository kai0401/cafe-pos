"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog, Toast } from "@/components/waiter/waiter-ui";
import { formatYen, PAYMENT_LABELS } from "@/lib/format";
import { flushOfflineQueue } from "@/lib/offline-queue";
import { waiterFetch } from "@/lib/waiter-api";
import { groupOrderItemsForDisplay, isModifierChildLine } from "@/lib/order-modifiers";
import { loadWaiterOrderSettings } from "@/lib/waiter-order-settings";
import { loadStaffSuggestions, saveStaffToHistory } from "@/lib/waiter-staff";

import { POS_ACCENT } from "@/lib/pos-theme";


const PAYMENT_METHODS = ["CASH", "CREDIT_CARD", "TRANSIT_IC", "QR", "STORES"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  channel?: string;
  customerCount: number;
  staffName: string | null;
  customerSegment: string | null;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
};

const SEGMENT_OPTIONS = ["家族連れ", "20代", "30代", "40代", "50代〜", "外国人観光客"];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function elapsedLabel(iso: string, now: number = Date.now()) {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}時間${rem}分` : `${hours}時間`;
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  PENDING: { label: "未送信", className: "bg-red-50 text-[var(--pos-danger)] border-red-200" },
  SENT: { label: "キッチン送信済", className: "bg-stone-100 text-stone-600 border-stone-200" },
  COOKING: { label: "調理中", className: "bg-[var(--pos-accent-soft)] text-[var(--pos-accent-press)] border-[var(--pos-accent)]/30" },
  DONE: { label: "調理完了", className: "bg-emerald-50 text-[var(--pos-success)] border-emerald-200" },
  SERVED: { label: "提供済", className: "bg-stone-100 text-stone-500 border-stone-200" },
  CANCELLED: { label: "取消", className: "bg-stone-100 text-stone-400 border-stone-200" },
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
  const [loadError, setLoadError] = useState("");
  const [orderLoadError, setOrderLoadError] = useState("");
  const [now, setNow] = useState(Date.now());

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showStoresPay, setShowStoresPay] = useState(false);
  const [storesSession, setStoresSession] = useState<{
    id: string;
    amount: number;
    paymentUrl?: string | null;
    status: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("");
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffDraft, setStaffDraft] = useState("");
  const [staffSuggestions, setStaffSuggestions] = useState<string[]>([]);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [cancelItemTarget, setCancelItemTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [guestUpdating, setGuestUpdating] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [tableOps, setTableOps] = useState<
    null | "menu" | "move" | "split-items" | "split-table" | "merge"
  >(null);
  const [tableChoices, setTableChoices] = useState<
    {
      id: string;
      name: string;
      orderId: string | null;
      itemCount: number;
      totalAmount: number;
      eatInType: string;
    }[]
  >([]);
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [tableOpsLoading, setTableOpsLoading] = useState(false);

  const eatInType = table?.eatInType === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
  const titlePrefix = eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  const totals = useMemo(() => {
    const items = order?.items ?? [];
    const displayItems = groupOrderItemsForDisplay(items);
    const count = displayItems.reduce((s, i) => s + i.quantity, 0);
    // 本体のないトッピング行（孤児）は合計に入れない
    const amount = displayItems.reduce((s, i) => s + i.lineTotal, 0);
    const pending = items.filter(
      (i) => i.status === "PENDING" && !isModifierChildLine(i.productId, i.note),
    );
    const pendingCount = pending.reduce((s, i) => s + i.quantity, 0);
    const inKitchenCount = items
      .filter(
        (i) =>
          ["SENT", "COOKING"].includes(i.status) &&
          !isModifierChildLine(i.productId, i.note),
      )
      .reduce((s, i) => s + i.quantity, 0);
    return { count, amount, pendingCount, inKitchenCount };
  }, [order]);

  const load = useCallback(async (opts?: { includeTable?: boolean }) => {
    const includeTable = opts?.includeTable !== false;
    setLoadError("");
    setOrderLoadError("");
    void flushOfflineQueue();
    try {
      if (includeTable) {
        const [tableRes, orderRes] = await Promise.all([
          waiterFetch(`/api/waiter/tables/${tableId}`),
          waiterFetch(`/api/waiter/orders?tableId=${tableId}`),
        ]);
        const tableData = await tableRes.json();
        if (!tableRes.ok) {
          setLoadError(tableData.error ?? "テーブル情報の読み込みに失敗しました");
          return;
        }
        setTable(tableData);
        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          setOrder(null);
          setOrderLoadError(orderData.error ?? "注文情報の読み込みに失敗しました");
          return;
        }
        setOrder(orderData?.id ? orderData : null);
        return;
      }

      const orderRes = await waiterFetch(`/api/waiter/orders?tableId=${tableId}`, {
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setOrderLoadError(orderData.error ?? "注文情報の読み込みに失敗しました");
        return;
      }
      setOrderLoadError("");
      setOrder(orderData?.id ? orderData : null);
    } catch {
      setLoadError("サーバーに接続できません");
    }
  }, [tableId]);

  useEffect(() => {
    void load({ includeTable: true });
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load({ includeTable: false });
    }, 12000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load({ includeTable: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    if (!order || guestUpdating) return;
    const next = Math.max(1, Math.min(20, order.customerCount + delta));
    setGuestUpdating(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateGuests", tableId, customerCount: next }),
      });
      if (res.ok) setOrder(await res.json());
      else {
        const data = await res.json();
        setToast(data.error ?? "人数の更新に失敗しました");
      }
    } finally {
      setGuestUpdating(false);
    }
  }

  async function saveMemo() {
    if (!order) return;
    const res = await waiterFetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateMemo", orderId: order.id, note: memoDraft }),
    });
    if (res.ok) {
      setOrder(await res.json());
      setMemoOpen(false);
    } else {
      const data = await res.json();
      setToast(data.error ?? "メモの保存に失敗しました");
    }
  }

  async function cancelTransaction() {
    if (!order) return;
    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelTransaction", orderId: order.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToast(data.error ?? "取引中止に失敗しました");
        return;
      }
      setShowCancelConfirm(false);
      router.push("/waiter/tables");
    } finally {
      setLoading(false);
    }
  }

  const discountValue = Math.max(0, Math.floor(Number(discount) || 0));
  const payableAmount = Math.max(0, totals.amount - discountValue);

  async function completeCheckout() {
    if (!order) return;
    if (discountValue > totals.amount) {
      setToast("値引き額が合計を超えています");
      return;
    }
    if (paymentMethod === "CASH") {
      const paid = Number(tendered);
      if (!paid || paid < payableAmount) {
        setToast("お預かり金額が不足しています");
        return;
      }
    }

    if (paymentMethod === "STORES") {
      setLoading(true);
      try {
        const res = await waiterFetch("/api/payments/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            discount: discountValue,
            mode: "terminal",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setToast(data.error ?? "STORES決済の開始に失敗しました");
          return;
        }
        setStoresSession(data.session);
        setShowCheckout(false);
        setShowStoresPay(true);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          orderId: order.id,
          paymentMethod,
          tendered: paymentMethod === "CASH" ? Number(tendered) : undefined,
          discount: discountValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "会計に失敗しました");
        return;
      }
      const change =
        paymentMethod === "CASH" && tendered
          ? Number(tendered) - data.totalAmount
          : 0;
      setShowCheckout(false);
      setToast(
        change > 0
          ? `会計完了 ${formatYen(data.totalAmount)}（お釣り ${formatYen(change)}）`
          : `会計完了（${formatYen(data.totalAmount)}）`,
      );
      setTimeout(() => router.push("/waiter/tables"), 1000);
    } finally {
      setLoading(false);
    }
  }

  async function confirmStoresPayment() {
    if (!storesSession) return;
    setLoading(true);
    try {
      const res = await waiterFetch("/api/payments/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          sessionId: storesSession.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "決済確認に失敗しました");
        return;
      }
      setShowStoresPay(false);
      setStoresSession(null);
      setToast(`会計完了（${formatYen(data.checkout?.totalAmount ?? storesSession.amount)}）`);
      setTimeout(() => router.push("/waiter/tables"), 1000);
    } finally {
      setLoading(false);
    }
  }

  function openCheckout() {
    if (totals.inKitchenCount > 0) {
      setToast("調理中の注文があります。調理完了後に会計してください");
      return;
    }
    if (totals.count === 0) {
      setToast("注文がありません");
      return;
    }
    setPaymentMethod("CASH");
    setDiscount("");
    setTendered(String(totals.amount));
    setShowCheckout(true);
  }

  function requestUpdateQty(itemId: string, quantity: number, productName: string) {
    if (quantity <= 0) {
      setCancelItemTarget({ id: itemId, name: productName });
      return;
    }
    void updateItemQty(itemId, quantity);
  }

  async function loadTableChoices(mode: "move" | "split-table" | "merge") {
    const res = await waiterFetch("/api/waiter/tables");
    const tables = await res.json();
    if (!res.ok || !Array.isArray(tables)) {
      setToast(tables?.error ?? "テーブル一覧の取得に失敗しました");
      return;
    }
    // T1〜T9 を常に全部表示。テイクアウト 1/2/3 は出さない
    const filtered = tables
      .filter(
        (t: {
          id: string;
          orderId: string | null;
          eatInType?: string;
          name?: string;
          number?: number;
        }) => t.eatInType === "DINE_IN" || /^T[1-9]$/i.test(String(t.name ?? "")),
      )
      .sort(
        (a: { number?: number; name?: string }, b: { number?: number; name?: string }) =>
          (a.number ?? 0) - (b.number ?? 0) ||
          String(a.name ?? "").localeCompare(String(b.name ?? ""), "ja"),
      );
    setTableChoices(filtered);
    const selectable = filtered.filter(
      (t: { id: string; orderId: string | null }) => {
        if (t.id === tableId) return false;
        return mode === "merge" ? Boolean(t.orderId) : !t.orderId;
      },
    );
    if (selectable.length === 0) {
      setToast(
        mode === "merge" ? "結合できるテーブルがありません" : "空いているテーブルがありません",
      );
    }
  }

  async function openTableOp(mode: "move" | "split-items" | "merge") {
    if (!order) {
      setToast("注文がありません");
      return;
    }
    if (mode === "split-items") {
      setSplitSelected(new Set());
      setTableOps("split-items");
      return;
    }
    setTableOps(mode === "move" ? "move" : "merge");
    await loadTableChoices(mode === "move" ? "move" : "merge");
  }

  async function confirmMove(targetTableId: string) {
    if (!order || tableOpsLoading) return;
    setTableOpsLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moveTable", orderId: order.id, targetTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "移動に失敗しました");
        return;
      }
      setTableOps(null);
      setToast("テーブルを移動しました");
      router.replace(`/waiter/order/${targetTableId}`);
    } finally {
      setTableOpsLoading(false);
    }
  }

  async function confirmSplit(targetTableId: string) {
    if (!order || tableOpsLoading || splitSelected.size === 0) return;
    setTableOpsLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "splitTable",
          orderId: order.id,
          targetTableId,
          itemIds: [...splitSelected],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "分割に失敗しました");
        return;
      }
      setTableOps(null);
      setSplitSelected(new Set());
      setToast("テーブルを分割しました");
      await load({ includeTable: true });
    } finally {
      setTableOpsLoading(false);
    }
  }

  async function confirmMerge(sourceOrderId: string) {
    if (!order || tableOpsLoading) return;
    setTableOpsLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mergeTable", orderId: order.id, sourceOrderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "結合に失敗しました");
        return;
      }
      setOrder(data);
      setTableOps(null);
      setToast("テーブルを結合しました");
    } finally {
      setTableOpsLoading(false);
    }
  }

  const splitCandidates = useMemo(
    () => groupOrderItemsForDisplay(order?.items ?? []),
    [order],
  );

  async function updateMeta(patch: { staffName?: string; customerSegment?: string }) {
    if (!order) return;
    const res = await waiterFetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateMeta", orderId: order.id, tableId, ...patch }),
    });
    if (res.ok) setOrder(await res.json());
    else {
      const data = await res.json();
      setToast(data.error ?? "更新に失敗しました");
    }
  }

  async function openStaffDialog() {
    if (!order) return;
    setStaffDraft(order.staffName ?? "");
    setStaffSuggestions(await loadStaffSuggestions());
    setStaffOpen(true);
  }

  async function saveStaff(name: string) {
    const trimmed = name.trim();
    await updateMeta({ staffName: trimmed });
    if (trimmed) saveStaffToHistory(trimmed);
    setStaffOpen(false);
  }

  async function serveItem(itemId: string) {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "serveItem", itemId, tableId }),
      });
      if (res.ok) setOrder(await res.json());
      else {
        const data = await res.json();
        setToast(data.error ?? "提供の更新に失敗しました");
      }
    } finally {
      setBusyItemId(null);
      setLoading(false);
    }
  }

  async function updateItemQty(itemId: string, quantity: number) {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateQty", tableId, itemId, quantity }),
      });
      if (res.ok) {
        const next = await res.json();
        setOrder(next);
        if (quantity <= 0) setToast("商品を取消しました");
      } else {
        const data = await res.json();
        setToast(data.error ?? "更新に失敗しました");
      }
    } finally {
      setBusyItemId(null);
      setLoading(false);
      setCancelItemTarget(null);
    }
  }

  async function printReceipt() {
    if (!order || !table) return;

    // TM-m30 が設定済みならプリンターへ、未設定ならブラウザ印刷
    const res = await waiterFetch("/api/printer/bill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    if (res.ok) {
      setToast("お会計伝票を印刷しました");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.error && data.error !== "プリンター未設定") {
      setToast(data.error);
      return;
    }

    const lines = order.items
      .map(
        (item) =>
          `<tr><td>${item.productName}${item.quantity > 1 ? ` ×${item.quantity}` : ""}</td><td style="text-align:right">${formatYen(item.unitPrice * item.quantity)}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>レシート</title></head><body style="font-family:sans-serif;padding:24px"><h1>あづま家</h1><p>テーブル: ${table.name}</p><p>注文番号: ${order.id.slice(-8)}</p><table style="width:100%;border-collapse:collapse">${lines}</table><p style="text-align:right;font-size:18px;font-weight:bold;margin-top:16px">合計 ${formatYen(totals.amount)}</p><script>window.print();</script></body></html>`;
    const win = window.open("", "_blank", "width=360,height=640");
    if (!win) {
      setToast("印刷ウィンドウを開けませんでした");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  function switchTab(next: Tab) {
    if (next === "order") {
      router.push(`/waiter/order/${tableId}/categories`);
      return;
    }
    setTab(next);
    router.replace(`/waiter/order/${tableId}?tab=${next}`, { scroll: false });
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--pos-bg)] p-6 text-center">
        <p className="text-stone-600">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-[var(--pos-accent)] px-6 py-2.5 text-white"
        >
          再読み込み
        </button>
        <Link href="/waiter/tables" className="mt-4 text-[14px] text-stone-500 underline">
          テーブル一覧へ
        </Link>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pos-bg)] text-stone-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pos-bg)] waiter-scroll-pad-bottom">
      {/* Header */}
      <header
        className="waiter-top-bar sticky top-0 z-20 flex shrink-0 items-center justify-between px-3 text-white"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <Link href="/waiter/tables" className="waiter-header-btn min-w-[56px] text-[15px] leading-none">
          ‹ 戻る
        </Link>
        <h1 className="truncate text-[15px] font-semibold">
          {titlePrefix} : {table.name}
          {order?.channel === "QR" && (
            <span className="ml-1 rounded bg-white/25 px-1.5 py-0.5 text-[11px]">QR</span>
          )}
        </h1>
        <button type="button" onClick={() => void load()} className="waiter-header-btn min-w-[56px] justify-end text-right text-[18px] leading-none" aria-label="更新">
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
            pendingCount={totals.pendingCount}
            inKitchenCount={totals.inKitchenCount}
            onGuests={updateGuests}
            onMemoOpen={() => {
              setMemoDraft(order.note ?? "");
              setMemoOpen(true);
            }}
            onStaffOpen={openStaffDialog}
            onSegmentOpen={() => setSegmentOpen(true)}
            onCheckout={openCheckout}
            onCancel={() => {
              if (loadWaiterOrderSettings().confirmBeforeCancel) {
                setShowCancelConfirm(true);
              } else {
                void cancelTransaction();
              }
            }}
            onPrint={printReceipt}
            onTable={() => setTableOps("menu")}
            loading={loading}
            guestUpdating={guestUpdating}
          />
        )}

        {tab === "summary" && !order && (
          <div className="p-8 text-center">
            <p className="text-stone-500">{orderLoadError || "注文がありません"}</p>
            {orderLoadError ? (
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-lg bg-[var(--pos-accent)] px-6 py-3 text-[15px] font-semibold text-white"
              >
                再読み込み
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/waiter/order/${tableId}/categories`)}
                className="mt-4 rounded-lg bg-[var(--pos-accent)] px-6 py-3 text-[15px] font-semibold text-white"
              >
                メニューから注文する
              </button>
            )}
          </div>
        )}

        {tab === "history" && (
          <HistoryTab
            items={order?.items ?? []}
            onUpdateQty={requestUpdateQty}
            onServe={serveItem}
            loading={loading}
            busyItemId={busyItemId}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="waiter-fixed-bottom pb-safe z-30 flex border-t border-stone-300 bg-white">
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
            className="flex flex-1 flex-col items-center py-3 text-[11px]"
            style={{ color: tab === t.id ? POS_ACCENT : "#888" }}
          >
            <span className="text-[20px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {staffOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold">担当スタッフ</h2>
            {staffSuggestions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {staffSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => saveStaff(name)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-[15px]"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={staffDraft}
              onChange={(e) => setStaffDraft(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-[16px]"
              placeholder="スタッフ名を入力"
            />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setStaffOpen(false)} className="flex-1 rounded-lg border py-3">
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => saveStaff(staffDraft)}
                className="flex-1 rounded-lg py-3 font-semibold text-white"
                style={{ backgroundColor: POS_ACCENT }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {segmentOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold">客層</h2>
            <div className="grid grid-cols-3 gap-2">
              {SEGMENT_OPTIONS.map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={async () => {
                    await updateMeta({ customerSegment: seg });
                    setSegmentOpen(false);
                  }}
                  className={`rounded-lg border py-3 text-[15px] active:bg-stone-50 ${order?.customerSegment === seg ? "border-[var(--pos-accent)] bg-[var(--pos-accent-soft)] font-semibold" : "border-stone-200"}`}
                >
                  {seg}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSegmentOpen(false)}
              className="mt-4 w-full rounded-lg border py-3"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {memoOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
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
                style={{ backgroundColor: POS_ACCENT }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white">
            <div className="border-b border-stone-100 px-5 pb-4 pt-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[17px] font-bold">会計</h2>
                <span className="text-[13px] text-stone-400">
                  {totals.count}点 / {order?.customerCount ?? 1}人
                </span>
              </div>
              <p className="mt-2 text-center text-[34px] font-bold tabular-nums" style={{ color: POS_ACCENT }}>
                {formatYen(payableAmount)}
              </p>
              {discountValue > 0 && (
                <div className="mt-1 flex justify-center gap-3 text-[13px] text-stone-500">
                  <span>小計 {formatYen(totals.amount)}</span>
                  <span className="text-red-500">値引き −{formatYen(discountValue)}</span>
                </div>
              )}
            </div>

            <div className="px-5 pt-4">
              <label className="mb-1 block text-[13px] font-medium text-stone-500">値引き（円）</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={discount}
                onChange={(e) => {
                  setDiscount(e.target.value);
                  const d = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setTendered(String(Math.max(0, totals.amount - d)));
                }}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-[16px]"
              />
            </div>

            <div className="px-5 pt-4">
              <p className="mb-2 text-[13px] font-medium text-stone-500">支払い方法</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`rounded-lg border py-3 text-[15px] font-medium active:bg-stone-50 ${
                      paymentMethod === m
                        ? "border-[var(--pos-accent)] bg-[var(--pos-accent-soft)] text-[var(--pos-accent-press)]"
                        : "border-stone-200 text-stone-700"
                    }`}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "CASH" && (
              <div className="px-5 pt-4">
                <label className="mb-1 block text-[13px] font-medium text-stone-500">お預かり</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-4 py-3 text-right text-[22px] font-semibold tabular-nums"
                />
                <div className="mt-2 flex gap-2">
                  {[
                    { label: "ちょうど", value: payableAmount },
                    { label: "¥1,000", value: 1000 },
                    { label: "¥5,000", value: 5000 },
                    { label: "¥10,000", value: 10000 },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setTendered(String(Math.max(q.value, payableAmount)))}
                      className="flex-1 rounded-lg border border-stone-300 py-3 text-[13px] font-medium text-stone-700 active:bg-stone-100"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between rounded-lg bg-stone-50 px-4 py-2.5">
                  <span className="text-[14px] text-stone-500">お釣り</span>
                  <span
                    className={`text-[20px] font-bold tabular-nums ${
                      Number(tendered) >= payableAmount ? "text-stone-900" : "text-red-500"
                    }`}
                  >
                    {Number(tendered) >= payableAmount
                      ? formatYen(Number(tendered) - payableAmount)
                      : "不足"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 px-5 py-5">
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="flex-1 rounded-lg border py-3.5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={completeCheckout}
                disabled={loading}
                className="flex-[2] rounded-lg py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: POS_ACCENT }}
              >
                {loading ? "処理中…" : "会計完了"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStoresPay && storesSession && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
            <h2 className="text-center text-[17px] font-bold">STORES決済</h2>
            <p className="mt-4 text-center text-[36px] font-bold tabular-nums" style={{ color: POS_ACCENT }}>
              {formatYen(storesSession.amount)}
            </p>
            <p className="mt-4 text-center text-[14px] leading-relaxed text-stone-600">
              STORES決済端末で上記金額を決済してください。
              <br />
              完了したら「決済完了」をタップしてください。
            </p>
            {storesSession.paymentUrl && (
              <a
                href={storesSession.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-lg border border-blue-200 bg-blue-50 py-3 text-center text-[14px] font-medium text-blue-700"
              >
                オンライン決済画面を開く
              </a>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowStoresPay(false);
                  setStoresSession(null);
                }}
                className="flex-1 rounded-lg border py-3.5"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={confirmStoresPayment}
                disabled={loading}
                className="flex-[2] rounded-lg py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: POS_ACCENT }}
              >
                {loading ? "処理中…" : "決済完了"}
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
          <p className="text-[15px] text-stone-600">
            このテーブルの未会計取引をすべて取消します。キッチンに出ている伝票も取り消されます。
            {order?.channel === "QR" && " QRオーダーのお客様画面もリセットされます。"}
          </p>
        </ConfirmDialog>
      )}

      {cancelItemTarget && (
        <ConfirmDialog
          title="注文を取消しますか？"
          confirmLabel="取消"
          onConfirm={() => {
            void updateItemQty(cancelItemTarget.id, 0);
            setCancelItemTarget(null);
          }}
          onCancel={() => setCancelItemTarget(null)}
        >
          <p className="text-[15px] text-stone-600">{cancelItemTarget.name} を取消します</p>
        </ConfirmDialog>
      )}

      {tableOps === "menu" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-[300px] overflow-hidden rounded-2xl bg-white shadow-xl">
            <p className="border-b border-stone-200 px-4 py-3 text-center text-[15px] font-semibold text-stone-900">
              テーブル操作
            </p>
            {(
              [
                { label: "テーブル移動", action: () => void openTableOp("move") },
                { label: "テーブル分割", action: () => void openTableOp("split-items") },
                { label: "テーブル結合", action: () => void openTableOp("merge") },
              ] as const
            ).map((row) => (
              <button
                key={row.label}
                type="button"
                disabled={!order || tableOpsLoading}
                onClick={row.action}
                className="w-full border-b border-stone-100 px-4 py-3.5 text-center text-[16px] text-[var(--pos-accent)] active:bg-stone-50 disabled:opacity-40"
              >
                {row.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTableOps(null)}
              className="w-full px-4 py-3.5 text-center text-[16px] text-[var(--pos-accent)] active:bg-stone-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {tableOps === "split-items" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="flex max-h-[85dvh] w-full max-w-[var(--waiter-width)] flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="border-b border-stone-200 px-4 py-3 text-center text-[15px] font-semibold">
              分割する商品を選択
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {splitCandidates.map((item) => {
                const selected = splitSelected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSplitSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left ${
                      selected ? "bg-[var(--pos-accent-soft)]" : "bg-white"
                    }`}
                  >
                    <span className="text-[15px] text-stone-900">{item.displayName}</span>
                    <span className="text-[14px] text-stone-500">{formatYen(item.lineTotal)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex border-t border-stone-200">
              <button
                type="button"
                onClick={() => setTableOps("menu")}
                className="flex-1 py-3.5 text-[15px] text-stone-500"
              >
                戻る
              </button>
              <button
                type="button"
                disabled={splitSelected.size === 0}
                onClick={async () => {
                  setTableOps("split-table");
                  await loadTableChoices("split-table");
                }}
                className="flex-1 py-3.5 text-[15px] font-semibold text-[var(--pos-accent)] disabled:opacity-40"
              >
                次へ（{splitSelected.size}点）
              </button>
            </div>
          </div>
        </div>
      )}

      {(tableOps === "move" || tableOps === "split-table" || tableOps === "merge") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="flex max-h-[85dvh] w-full max-w-[var(--waiter-width)] flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="border-b border-stone-200 px-4 py-3 text-center text-[15px] font-semibold">
              {tableOps === "move"
                ? "移動先テーブル"
                : tableOps === "split-table"
                  ? "分割先テーブル"
                  : "結合するテーブル"}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tableChoices.map((t) => {
                const isCurrent = t.id === tableId;
                const occupied = Boolean(t.orderId);
                const selectable =
                  !isCurrent && (tableOps === "merge" ? occupied : !occupied);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={tableOpsLoading || !selectable}
                    onClick={() => {
                      if (!selectable) return;
                      if (tableOps === "move") void confirmMove(t.id);
                      else if (tableOps === "split-table") void confirmSplit(t.id);
                      else if (t.orderId) void confirmMerge(t.orderId);
                    }}
                    className="flex w-full items-center justify-between border-b border-stone-100 px-4 py-3.5 text-left active:bg-stone-50 disabled:opacity-40"
                  >
                    <span className="text-[16px] font-medium text-stone-900">{t.name}</span>
                    <span className="text-[13px] text-stone-500">
                      {isCurrent
                        ? "現在"
                        : occupied
                          ? `${t.itemCount}点 / ${formatYen(t.totalAmount)}`
                          : "空席"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() =>
                setTableOps(tableOps === "split-table" ? "split-items" : "menu")
              }
              className="border-t border-stone-200 py-3.5 text-[15px] text-stone-500"
            >
              戻る
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

function SummaryTab({
  order,
  now,
  totals,
  pendingCount,
  inKitchenCount,
  onGuests,
  onMemoOpen,
  onStaffOpen,
  onSegmentOpen,
  onCheckout,
  onCancel,
  onPrint,
  onTable,
  loading = false,
  guestUpdating = false,
}: {
  order: Order;
  now: number;
  totals: { count: number; amount: number };
  pendingCount: number;
  inKitchenCount: number;
  onGuests: (delta: number) => void;
  onMemoOpen: () => void;
  onStaffOpen: () => void;
  onSegmentOpen: () => void;
  onCheckout: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onTable: () => void;
  loading?: boolean;
  guestUpdating?: boolean;
}) {
  const rows = [
    { label: "入店時間", value: formatDateTime(order.createdAt), action: null },
    { label: "経過時間", value: elapsedLabel(order.createdAt, now), action: null },
    { label: "スタッフ", value: order.staffName || "未設定", action: "chevron" as const, onClick: onStaffOpen },
    { label: "人数", value: `${order.customerCount}人`, action: "guests" as const },
    { label: "客層", value: order.customerSegment || "未設定", action: "chevron" as const, onClick: onSegmentOpen },
    {
      label: "合計",
      value: `${totals.count}点`,
      sub: formatYen(totals.amount),
      action: null,
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
                  disabled={loading || guestUpdating}
                  onClick={() => onGuests(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[20px] disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[40px] text-center text-[16px]">{row.value}</span>
                <button
                  type="button"
                  disabled={loading || guestUpdating}
                  onClick={() => onGuests(1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[20px] disabled:opacity-40"
                >
                  ＋
                </button>
              </div>
            ) : (
              <>
                <div className="text-right">
                  <div className="text-[16px] text-stone-900">{row.value}</div>
                  {"sub" in row && row.sub && (
                    <div className="text-[15px] font-bold" style={{ color: POS_ACCENT }}>
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
        {pendingCount > 0 && (
          <p className="mb-3 rounded-lg bg-[var(--pos-accent-soft)] px-3 py-2 text-center text-[13px] text-[var(--pos-accent-press)]">
            未送信 {pendingCount} 点も会計に含まれます
          </p>
        )}
          {inKitchenCount > 0 && (
          <p className="mb-3 rounded-lg bg-stone-100 px-3 py-2 text-center text-[13px] text-stone-600">
            調理中 {inKitchenCount} 点 — 調理完了後に会計できます
          </p>
        )}
        {order.channel === "QR" && (
          <p className="mb-3 rounded-lg bg-[var(--pos-accent-soft)] px-3 py-2 text-center text-[13px] text-[var(--pos-accent-press)]">
            QRオーダー中 — 取引中止でお客様画面もリセットされます
          </p>
        )}
        <button
          type="button"
          onClick={onCheckout}
          disabled={loading || inKitchenCount > 0 || totals.count === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--pos-accent)] py-4 text-[17px] font-semibold text-white active:bg-[var(--pos-accent-press)] disabled:opacity-50"
        >
          会計する（{formatYen(totals.amount)}）
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

function HistoryTab({
  items,
  onUpdateQty,
  onServe,
  loading,
  busyItemId,
}: {
  items: OrderItem[];
  onUpdateQty: (itemId: string, quantity: number, productName: string) => void;
  onServe: (itemId: string) => void;
  loading: boolean;
  busyItemId: string | null;
}) {
  const displayItems = groupOrderItemsForDisplay(items);

  if (displayItems.length === 0) {
    return <p className="p-8 text-center text-stone-400">注文履歴がありません</p>;
  }

  const totalCount = displayItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = displayItems.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2 text-[13px] text-stone-500">
        <span>{totalCount}点</span>
        <span className="font-semibold tabular-nums" style={{ color: POS_ACCENT }}>
          {formatYen(totalAmount)}
        </span>
      </div>
      {[...displayItems].reverse().map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-[14px]"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[16px] text-stone-900">
              {item.displayName}
              {item.quantity > 1 && !item.status.includes("PENDING") && ` ×${item.quantity}`}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[12px] text-stone-400">
              {formatDateTime(item.createdAt).slice(11, 16)}
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${
                  (STATUS_CHIP[item.status] ?? STATUS_CHIP.SENT!).className
                }`}
              >
                {(STATUS_CHIP[item.status] ?? { label: item.status }).label}
              </span>
            </p>
            {item.status === "PENDING" && (
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={loading || busyItemId === item.id}
                  onClick={() => onUpdateQty(item.id, item.quantity - 1, item.productName)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[18px] disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[24px] text-center text-[15px] font-medium">{item.quantity}</span>
                <button
                  type="button"
                  disabled={loading || busyItemId === item.id}
                  onClick={() => onUpdateQty(item.id, item.quantity + 1, item.productName)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[18px] disabled:opacity-40"
                >
                  ＋
                </button>
                <button
                  type="button"
                  disabled={loading || busyItemId === item.id}
                  onClick={() => onUpdateQty(item.id, 0, item.productName)}
                  className="ml-2 flex h-11 items-center rounded-lg border border-red-200 px-3 text-[13px] font-medium text-[var(--pos-danger)] active:bg-red-50 disabled:opacity-40"
                >
                  取消
                </button>
              </div>
            )}
            {item.status !== "PENDING" && item.status !== "CANCELLED" && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={loading || busyItemId === item.id}
                  onClick={() => onUpdateQty(item.id, 0, item.productName)}
                  className="flex h-11 items-center rounded-lg border border-red-200 px-3 text-[13px] font-medium text-[var(--pos-danger)] active:bg-red-50 disabled:opacity-40"
                >
                  取消
                </button>
              </div>
            )}
          </div>
          <div className="ml-3 flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-[15px] font-medium" style={{ color: POS_ACCENT }}>
              {formatYen(item.lineTotal)}
            </span>
            {(item.status === "DONE" || item.status === "SENT" || item.status === "COOKING") && (
              <button
                type="button"
                disabled={loading || busyItemId === item.id}
                onClick={() => onServe(item.id)}
                className="flex h-10 items-center rounded-full bg-[var(--pos-success)] px-4 text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-40"
              >
                提供する
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
