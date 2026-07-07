"use client";

import { useCallback, useEffect, useState } from "react";
import { KpiCard, PageHeader } from "@/components/admin/ui";
import { formatYen } from "@/lib/format";

type Closing = {
  businessDate: string;
  salesCount: number;
  salesTotal: number;
  refundCount: number;
  refundTotal: number;
  netTotal: number;
  discountTotal: number;
  taxTotal: number;
  customerCount: number;
  avgSpend: number;
  payments: { method: string; label: string; amount: number }[];
  openOrderCount: number;
  closedAt: string | null;
};

export default function ClosingPage() {
  const [data, setData] = useState<Closing | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    fetch("/api/closing")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function executeClosing() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/closing", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.error ?? "締め処理に失敗しました");
      } else {
        setMessage(
          result.printed
            ? "レジ締めが完了しました。締めレポートを印刷しました。"
            : "レジ締めが完了しました（プリンター未接続のため印刷はスキップ）。",
        );
        load();
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!data) {
    return <p className="text-stone-400">読み込み中…</p>;
  }

  return (
    <div>
      <PageHeader title="レジ締め" description={`営業日: ${data.businessDate}`}>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/export/sales"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            月次CSV出力
          </a>
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={executeClosing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "処理中…" : "締めを確定する"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
            >
              レジ締めを実行
            </button>
          )}
        </div>
      </PageHeader>

      {message && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      )}

      {data.openOrderCount > 0 && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          未会計のテーブルが {data.openOrderCount} 件あります。締め前に会計を完了してください。
        </p>
      )}

      {data.closedAt && (
        <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          本日は締め済みです（{new Date(data.closedAt).toLocaleString("ja-JP")}）。再実行すると最新の内容で上書きされます。
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="純売上" value={formatYen(data.netTotal)} sub={`売上 ${data.salesCount}件`} />
        <KpiCard title="客数" value={`${data.customerCount}名`} sub={`客単価 ${formatYen(data.avgSpend)}`} />
        <KpiCard
          title="返金"
          value={formatYen(Math.abs(data.refundTotal))}
          sub={`${data.refundCount}件`}
        />
        <KpiCard title="値引き" value={formatYen(data.discountTotal)} sub={`内消費税 ${formatYen(data.taxTotal)}`} />
      </div>

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-stone-600">支払い方法別</h2>
        {data.payments.length === 0 && <p className="text-sm text-stone-400">本日の取引はまだありません</p>}
        {data.payments.map((p) => (
          <div key={p.method} className="flex justify-between border-b border-stone-100 py-2.5 text-sm last:border-0">
            <span className="text-stone-700">{p.label}</span>
            <span className="font-semibold tabular-nums text-stone-900">{formatYen(p.amount)}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        締めを実行すると、本日のサマリーがレポートとして保存され、TM-m30 から締めレポートが印刷されます。
      </p>
    </div>
  );
}
