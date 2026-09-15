"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RemoteShell, yen, REMOTE_TEAL } from "@/components/remote/remote-ui";
import { remoteFetch } from "@/lib/remote-api";
import { PAYMENT_LABELS } from "@/lib/format";

type Tx = {
  id: string;
  transactionAt: string;
  totalAmount: number;
  customerCount: number;
  tableNumber: number | null;
  tableName: string | null;
  staffName: string | null;
  payments: { method: string; amount: number }[];
  items: { name: string; quantity: number; totalAmount: number }[];
  refunded: boolean;
  openOrder?: boolean;
};

export default function RemoteDayPage() {
  const params = useParams();
  const date = params.date as string;
  const month = date?.slice(0, 7) ?? "";
  const [txs, setTxs] = useState<Tx[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await remoteFetch(`/api/waiter/history?date=${encodeURIComponent(date)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "取引の取得に失敗しました");
        setTxs([]);
        return;
      }
      if (!Array.isArray(json)) {
        setError("データの形式が不正です");
        setTxs([]);
        return;
      }
      setTxs(json);
    } catch {
      setError("接続に失敗しました");
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const active = txs.filter((t) => !t.refunded);
    return {
      count: active.length,
      total: active.reduce((s, t) => s + t.totalAmount, 0),
    };
  }, [txs]);

  function timeLabel(iso: string) {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <RemoteShell
      title={date}
      backHref={month ? `/remote/month/${month}` : "/remote"}
      right={
        <button type="button" onClick={() => void load()} className="text-[14px] text-white/90">
          更新
        </button>
      }
    >
      {!loading && !error && (
        <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[13px] text-stone-500">日次売上</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums" style={{ color: POS_ACCENT }}>
            {yen(summary.total)}
          </p>
          <p className="mt-1 text-[14px] text-stone-600">{summary.count} 件</p>
        </div>
      )}

      {loading && <p className="py-12 text-center text-stone-400">読み込み中…</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}
      {!loading && !error && txs.length === 0 && (
        <p className="py-12 text-center text-stone-400">取引がありません</p>
      )}

      <div className="space-y-2">
        {txs.map((tx) => {
          const open = expanded === tx.id;
          return (
            <button
              key={tx.id}
              type="button"
              onClick={() => setExpanded(open ? null : tx.id)}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-stone-900">
                    {timeLabel(tx.transactionAt)}
                    {tx.tableName || tx.tableNumber != null
                      ? ` · ${tx.tableName ?? `T${tx.tableNumber}`}`
                      : ""}
                    {tx.openOrder ? " · 未会計" : ""}
                    {tx.refunded ? " · 取消済" : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] text-stone-500">
                    {tx.customerCount}名
                    {tx.staffName ? ` · ${tx.staffName}` : ""}
                    {tx.payments?.length
                      ? ` · ${tx.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join("・")}`
                      : ""}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-[17px] font-bold tabular-nums ${tx.refunded ? "text-stone-400 line-through" : "text-stone-900"}`}
                >
                  {yen(tx.totalAmount)}
                </p>
              </div>
              {open && (
                <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3">
                  {tx.items.map((item, i) => (
                    <li key={`${tx.id}-${i}`} className="flex justify-between text-[13px] text-stone-700">
                      <span>
                        {item.name}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                      <span className="tabular-nums">{yen(item.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </RemoteShell>
  );
}
