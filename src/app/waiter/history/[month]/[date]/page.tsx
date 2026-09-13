"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ConfirmDialog, Toast, WaiterHeader } from "@/components/waiter/waiter-ui";
import { formatYen, PAYMENT_LABELS } from "@/lib/format";
import { waiterFetch } from "@/lib/waiter-api";
import { POS_ACCENT } from "@/lib/pos-theme";


type Tx = {
  id: string;
  externalId: string;
  dataSource: string;
  transactionType: string;
  transactionAt: string;
  entryTime: string | null;
  totalAmount: number;
  customerCount: number;
  tableNumber: number | null;
  tableName: string | null;
  staffName: string | null;
  customerSegment: string | null;
  payments: { method: string; amount: number }[];
  items: { name: string; quantity: number; totalAmount: number }[];
  refunded: boolean;
  canRefund: boolean;
  openOrder?: boolean;
};

export default function HistoryDayDetailPage() {
  const params = useParams();
  const month = params.month as string;
  const date = params.date as string;
  const [txs, setTxs] = useState<Tx[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<Tx | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    setPageLoading(true);
    try {
      const res = await waiterFetch(`/api/waiter/history?date=${date}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? "取引の読み込みに失敗しました");
        setTxs([]);
        return;
      }
      if (!Array.isArray(data)) {
        setLoadError("取引データの形式が不正です");
        setTxs([]);
        return;
      }
      setTxs(data);
    } catch {
      setLoadError("取引の読み込みに失敗しました");
      setTxs([]);
    } finally {
      setPageLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function executeRefund() {
    if (!refundTarget) return;
    setLoading(true);
    try {
      const res = await waiterFetch("/api/sales/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: refundTarget.id }),
      });
      const data = await res.json();
      setToast(res.ok ? "取引を取消しました" : (data.error ?? "取消に失敗しました"));
      setRefundTarget(null);
      if (res.ok) await load();
    } catch {
      setToast("取消に失敗しました");
      setRefundTarget(null);
    } finally {
      setLoading(false);
    }
  }

  function timeLabel(iso: string) {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }

  function dwellLabel(entryIso: string | null, checkoutIso: string) {
    if (!entryIso) return null;
    const mins = Math.max(
      0,
      Math.round((new Date(checkoutIso).getTime() - new Date(entryIso).getTime()) / 60000),
    );
    if (mins < 60) return `滞在 ${mins}分`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `滞在 ${h}時間${m}分` : `滞在 ${h}時間`;
  }

  return (
    <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
      <WaiterHeader title={date} backHref={`/waiter/history/${month}`} onRefresh={() => void load()} />

      {pageLoading && (
        <p className="p-8 text-center text-stone-400">読み込み中…</p>
      )}
      {loadError && (
        <p className="p-8 text-center text-[14px] text-red-600">{loadError}</p>
      )}
      {!pageLoading && !loadError && txs.length === 0 && (
        <p className="p-8 text-center text-stone-400">取引がありません</p>
      )}

      {txs.map((tx) => {
        const isRefund = tx.transactionType === "REFUND";
        const isOpenOrder = tx.openOrder || tx.transactionType === "ORDER";
        const open = expanded === tx.id;
        const dwell = dwellLabel(tx.entryTime, tx.transactionAt);
        return (
          <div key={tx.id} className="border-b border-stone-200 bg-white">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : tx.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-stone-900">
                  {timeLabel(tx.transactionAt)}
                  {tx.tableNumber != null && ` · T${tx.tableNumber}`}
                  {tx.customerCount > 0 && ` · ${tx.customerCount}名`}
                </p>
                <p className="mt-0.5 text-[12px] text-stone-400">
                  {isOpenOrder ? "未会計" : tx.dataSource === "SMAREGI" ? "スマレジ" : "会計済"}
                  {isRefund && <span className="ml-1 text-red-500">返金</span>}
                  {tx.refunded && <span className="ml-1 text-red-500">取消済</span>}
                  {tx.staffName && ` · ${tx.staffName}`}
                  {tx.customerSegment && ` · ${tx.customerSegment}`}
                </p>
              </div>
              <span
                className={`shrink-0 text-[17px] font-bold tabular-nums ${tx.refunded ? "text-stone-300 line-through" : ""}`}
                style={{ color: tx.refunded ? undefined : isRefund ? "#dc2626" : POS_ACCENT }}
              >
                {formatYen(tx.totalAmount)}
              </span>
              <span className="shrink-0 text-[14px] text-stone-300">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
              <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                {tx.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-0.5 text-[14px] text-stone-700">
                    <span>
                      {item.name}
                      {Math.abs(item.quantity) > 1 && ` ×${Math.abs(item.quantity)}`}
                    </span>
                    <span className="tabular-nums">{formatYen(item.totalAmount)}</span>
                  </div>
                ))}
                {tx.payments.length > 0 && (
                  <p className="mt-2 text-[12px] text-stone-400">
                    支払い: {tx.payments.map((p) => `${PAYMENT_LABELS[p.method] ?? p.method} ${formatYen(p.amount)}`).join(" / ")}
                  </p>
                )}
                {(tx.entryTime || tx.customerSegment) && (
                  <p className="mt-1 text-[12px] text-stone-400">
                    {tx.entryTime && `入店 ${timeLabel(tx.entryTime)}`}
                    {tx.entryTime && dwell && ` · ${dwell}`}
                    {tx.customerSegment && ` · 客層 ${tx.customerSegment}`}
                  </p>
                )}
                {tx.canRefund && (
                  <button
                    type="button"
                    onClick={() => setRefundTarget(tx)}
                    className="mt-3 w-full rounded-lg border border-red-300 py-2.5 text-[14px] font-medium text-red-600"
                  >
                    この取引を取消（返金）
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {refundTarget && (
        <ConfirmDialog
          title="取引を取消しますか？"
          confirmLabel={loading ? "処理中…" : "取消する"}
          onConfirm={executeRefund}
          onCancel={() => setRefundTarget(null)}
        >
          <p className="text-[15px] text-stone-600">
            {formatYen(refundTarget.totalAmount)} の返金取引を POS
            上に作成します。元の取引データは保持されます。
          </p>
          <p className="mt-3 text-[13px] text-[var(--pos-danger)]">
            STORES / カード決済の場合は、端末側でも別途返金操作が必要です。先に端末で返金してから実行してください。
          </p>
        </ConfirmDialog>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
