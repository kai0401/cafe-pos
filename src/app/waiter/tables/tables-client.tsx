"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutSheet } from "@/components/waiter/checkout-sheet";
import {
  ConfirmDialog,
  GuestCountDialog,
  SectionLabel,
  Toast,
  WaiterHeader,
} from "@/components/waiter/waiter-ui";
import { formatYen } from "@/lib/format";
import { flushOfflineQueue } from "@/lib/offline-queue";
import { POS_ACCENT } from "@/lib/pos-theme";
import { waiterFetch } from "@/lib/waiter-api";

export type TableRow = {
  id: string;
  name: string;
  eatInType: string;
  status: string;
  pendingCount: number;
  inKitchenCount?: number;
  itemCount: number;
  customerCount?: number;
  totalAmount?: number;
  orderId: string | null;
};

const ACTION_W = 88;
const ACTIONS_W = ACTION_W * 2;
const OPEN_THRESHOLD = 48;

function SwipeTableRow({
  table,
  open,
  onOpenChange,
  onOpenTable,
  onCheckout,
  onCancel,
}: {
  table: TableRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTable: () => void;
  onCheckout: () => void;
  onCancel: () => void;
}) {
  const occupied = Boolean(table.orderId);
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);
  const axis = useRef<"undecided" | "h" | "v">("undecided");
  const moved = useRef(false);

  useEffect(() => {
    const next = open ? -ACTIONS_W : 0;
    offsetRef.current = next;
    setOffset(next);
  }, [open]);

  const amount = table.totalAmount ?? 0;
  const subParts: string[] = [];
  if (table.itemCount > 0) subParts.push(`${table.itemCount}点`);
  if (amount > 0) subParts.push(formatYen(amount));
  if ((table.inKitchenCount ?? 0) > 0) subParts.push(`調理中${table.inKitchenCount}`);

  function clamp(v: number) {
    if (!occupied) return 0;
    return Math.max(-ACTIONS_W, Math.min(0, v));
  }

  function onPointerDown(clientX: number, clientY: number) {
    if (!occupied) return;
    dragging.current = true;
    axis.current = "undecided";
    moved.current = false;
    startX.current = clientX;
    startY.current = clientY;
    startOffset.current = offsetRef.current;
  }

  function onPointerMove(clientX: number, clientY: number, e: { preventDefault: () => void }) {
    if (!dragging.current || !occupied) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    if (axis.current === "undecided") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axis.current === "v") {
        dragging.current = false;
        return;
      }
    }
    if (axis.current !== "h") return;
    e.preventDefault();
    moved.current = true;
    const next = clamp(startOffset.current + dx);
    offsetRef.current = next;
    setOffset(next);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (axis.current !== "h") return;
    const shouldOpen = offsetRef.current < -OPEN_THRESHOLD;
    onOpenChange(shouldOpen);
    const next = shouldOpen ? -ACTIONS_W : 0;
    offsetRef.current = next;
    setOffset(next);
  }

  return (
    <div className="relative overflow-hidden border-b border-stone-200 bg-white">
      {occupied && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_W }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onCancel();
            }}
            className="flex h-full w-[88px] flex-col items-center justify-center bg-red-500 px-1 text-[13px] font-semibold leading-tight text-white active:bg-red-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onCheckout();
            }}
            className="flex h-full w-[88px] flex-col items-center justify-center px-1 text-[13px] font-semibold leading-tight text-white active:opacity-90"
            style={{ backgroundColor: POS_ACCENT }}
          >
            会計完了
          </button>
        </div>
      )}

      <div
        className="relative z-[1] min-h-[56px] bg-white touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 180ms ease-out",
        }}
        onTouchStart={(e) => onPointerDown(e.touches[0]!.clientX, e.touches[0]!.clientY)}
        onTouchMove={(e) => onPointerMove(e.touches[0]!.clientX, e.touches[0]!.clientY, e)}
        onTouchEnd={onPointerUp}
        onTouchCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={() => {
            if (moved.current) return;
            if (open) {
              onOpenChange(false);
              return;
            }
            onOpenTable();
          }}
          className="flex min-h-[56px] w-full items-center justify-between px-4 py-2.5 text-left active:bg-stone-50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[16px] leading-tight text-stone-900">{table.name}</span>
              {table.pendingCount > 0 && (
                <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  未送信 {table.pendingCount}
                </span>
              )}
            </div>
            {subParts.length > 0 ? (
              <p className="mt-0.5 text-[12px] leading-tight text-stone-400">{subParts.join(" · ")}</p>
            ) : (
              !occupied && <p className="mt-0.5 text-[12px] leading-tight text-stone-400">空席</p>
            )}
          </div>
          {!occupied && <span className="ml-2 shrink-0 text-[16px] text-stone-300">›</span>}
        </button>
      </div>
    </div>
  );
}

export function WaiterTablesClient({ initialTables }: { initialTables: TableRow[] }) {
  const router = useRouter();
  const [tables, setTables] = useState<TableRow[]>(initialTables);
  const [guestDialog, setGuestDialog] = useState<{ tableId: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [checkoutTarget, setCheckoutTarget] = useState<TableRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TableRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);

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
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function handleTableClick(table: TableRow) {
    if (table.orderId) {
      router.push(`/waiter/order/${table.id}`);
      return;
    }
    setGuestDialog({ tableId: table.id, name: table.name });
  }

  function requestCheckout(table: TableRow) {
    if (!table.orderId || (table.itemCount ?? 0) <= 0) {
      setToast("注文がありません");
      return;
    }
    if ((table.inKitchenCount ?? 0) > 0) {
      setToast("調理中の注文があります。調理完了後に会計してください");
      return;
    }
    setCheckoutTarget(table);
  }

  async function confirmCancel() {
    if (!cancelTarget?.orderId) return;
    setCancelLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelTransaction", orderId: cancelTarget.orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error ?? "キャンセルに失敗しました");
        return;
      }
      setToast(`${cancelTarget.name} をキャンセルしました`);
      setCancelTarget(null);
      void load();
    } finally {
      setCancelLoading(false);
    }
  }

  async function confirmGuest(count: number) {
    if (!guestDialog) return;
    const tableId = guestDialog.tableId;
    setOpeningTableId(tableId);
    try {
      const res = await fetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", tableId, customerCount: count }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.id) {
        throw new Error(data.error ?? "テーブルを開始できませんでした");
      }
      setGuestDialog(null);
      router.push(`/waiter/order/${tableId}/categories`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "テーブルを開始できませんでした");
    } finally {
      setOpeningTableId(null);
    }
  }

  const dineIn = tables.filter((t) => t.eatInType === "DINE_IN");
  const takeout = tables.filter((t) => t.eatInType === "TAKEOUT");

  function renderRows(list: TableRow[]) {
    if (list.length === 0) {
      return <p className="bg-white px-4 py-3 text-[14px] text-stone-400">テーブルがありません</p>;
    }
    return list.map((t) => (
      <SwipeTableRow
        key={t.id}
        table={t}
        open={swipedId === t.id}
        onOpenChange={(next) => setSwipedId(next ? t.id : null)}
        onOpenTable={() => handleTableClick(t)}
        onCheckout={() => requestCheckout(t)}
        onCancel={() => setCancelTarget(t)}
      />
    ));
  }

  return (
    <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
      <WaiterHeader title="テーブル一覧" backHref="/waiter" onRefresh={load} />


      {loadError && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {loadError}
          <button type="button" onClick={load} className="ml-2 underline">
            再試行
          </button>
        </div>
      )}

      <p className="px-4 py-2 text-[12px] text-stone-400">
        注文中のテーブルを左にスワイプ → キャンセル / 会計完了
      </p>

      <SectionLabel>イートイン</SectionLabel>
      {renderRows(dineIn)}

      <SectionLabel>テイクアウト</SectionLabel>
      {renderRows(takeout)}

      {guestDialog && (
        <GuestCountDialog
          onConfirm={confirmGuest}
          onCancel={() => setGuestDialog(null)}
          confirmLabel={openingTableId ? "開始中…" : undefined}
          disabled={Boolean(openingTableId)}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title={`${cancelTarget.name} をキャンセル`}
          confirmLabel={cancelLoading ? "処理中…" : "中止する"}
          onConfirm={() => {
            if (!cancelLoading) void confirmCancel();
          }}
          onCancel={() => setCancelTarget(null)}
        >
          <p className="text-[15px] text-stone-600">
            このテーブルの未会計取引をすべて取消します。キッチン伝票も取り消されます。
          </p>
        </ConfirmDialog>
      )}

      {checkoutTarget?.orderId && (
        <CheckoutSheet
          open
          orderId={checkoutTarget.orderId}
          tableName={checkoutTarget.name}
          amount={checkoutTarget.totalAmount ?? 0}
          itemCount={checkoutTarget.itemCount}
          customerCount={checkoutTarget.customerCount ?? 1}
          onClose={() => setCheckoutTarget(null)}
          onCompleted={(message) => {
            setCheckoutTarget(null);
            setToast(message);
            void load();
          }}
        />
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
