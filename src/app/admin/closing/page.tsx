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
            : result.smaregiArchiveDir
              ? `レジ締めが完了しました。スマレジ形式CSVを ${result.smaregiArchiveDir} に保存しました。`
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
    return (
      <div>
        <PageHeader eyebrow="CLOSING" title="レジ締め" />
        <div className="admin-card p-10 text-center text-sm text-[var(--admin-muted)]">読み込み中…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="CLOSING" title="レジ締め" description={`営業日: ${data.businessDate}`}>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/export/smaregi/transactions?date=${data.businessDate}&dataSource=ALL`}
            className="admin-btn admin-btn--ghost"
          >
            スマレジ形式CSV
          </a>
          <a href="/api/admin/export/smaregi/products" className="admin-btn admin-btn--ghost">
            商品CSV
          </a>
          <a href="/api/admin/export/sales" className="admin-btn admin-btn--ghost">
            月次CSV（内部）
          </a>
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="admin-btn admin-btn--ghost"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={executeClosing}
                className="admin-btn !bg-[var(--admin-vermillion)] !text-white disabled:opacity-50"
              >
                {loading ? "処理中…" : "締めを確定する"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="admin-btn admin-btn--primary"
            >
              レジ締めを実行
            </button>
          )}
        </div>
      </PageHeader>

      {message && (
        <p className="mb-6 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-accent-soft)] px-4 py-3 text-sm text-[var(--admin-ink)]">
          {message}
        </p>
      )}

      {data.openOrderCount > 0 && (
        <p className="mb-6 rounded-xl border border-[var(--admin-vermillion)]/30 bg-[rgba(184,74,58,0.08)] px-4 py-3 text-sm font-medium text-[var(--admin-vermillion)]">
          未会計のテーブルが {data.openOrderCount} 件あります。締め前に会計を完了してください。
        </p>
      )}

      {data.closedAt && (
        <p className="mb-6 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-sage-soft)] px-4 py-3 text-sm text-[var(--admin-sage)]">
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

      <div className="admin-card mt-8 p-6">
        <h2 className="admin-title admin-brand-serif mb-4 text-base">支払い方法別</h2>
        {data.payments.length === 0 && (
          <p className="text-sm text-[var(--admin-muted)]">本日の取引はまだありません</p>
        )}
        {data.payments.map((p) => (
          <div
            key={p.method}
            className="flex justify-between border-b border-[var(--admin-line)]/60 py-2.5 text-sm last:border-0"
          >
            <span className="text-[var(--admin-ink)]">{p.label}</span>
            <span className="font-semibold tabular-nums text-[var(--admin-ink)]">{formatYen(p.amount)}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[var(--admin-muted)]">
        締めを実行すると、本日のサマリーがレポートとして保存されます。クラウド運用では TM-m30
        印刷は行われません（必要なら管理画面から CSV / 画面で確認）。
      </p>
    </div>
  );
}
