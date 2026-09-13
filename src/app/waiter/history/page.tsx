"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { HistoryMonthRow } from "@/components/waiter/history-row";
import { waiterFetch } from "@/lib/waiter-api";
import { formatYen } from "@/lib/format";
import { POS_ACCENT } from "@/lib/pos-theme";

type MonthRow = { month: string; count: number; total: number };
type TodayRow = {
  date: string;
  count: number;
  total: number;
  openCount: number;
  openTotal?: number;
};
type HistoryIndex = { today: TodayRow; months: MonthRow[] };

export default function WaiterHistoryPage() {
  const [data, setData] = useState<HistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    waiterFetch("/api/waiter/history")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setError(json.error ?? "取引履歴の読み込みに失敗しました");
          return;
        }
        if (Array.isArray(json)) {
          setData({
            today: { date: "", count: 0, total: 0, openCount: 0, openTotal: 0 },
            months: json,
          });
          return;
        }
        if (!json || !Array.isArray(json.months)) {
          setError("取引データの形式が不正です");
          return;
        }
        setData(json);
      })
      .catch(() => setError("取引履歴の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const today = data?.today;
  const todayHref =
    today?.date && today.date.length >= 7
      ? `/waiter/history/${today.date.slice(0, 7)}/${today.date}`
      : null;

  return (
    <div className="min-h-screen bg-white">
      <WaiterHeader title="取引履歴" backHref="/waiter" />
      {loading && <p className="p-8 text-center text-[15px] text-stone-400">読み込み中…</p>}
      {error && <p className="p-8 text-center text-[15px] text-red-600">{error}</p>}

      {today && today.date && (
        <Link
          href={todayHref ?? "/waiter/history"}
          className="flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3.5 active:bg-stone-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold text-stone-900">本日</p>
            <p className="mt-0.5 text-[12px] text-stone-500">{today.date}</p>
            {today.openCount > 0 ? (
              <p className="mt-1 text-[12px] leading-relaxed text-amber-700">
                未会計 {today.openCount}件
                {typeof today.openTotal === "number" ? `（${formatYen(today.openTotal)}）` : ""}
                を含む
              </p>
            ) : today.count === 0 ? (
              <p className="mt-1 text-[12px] leading-relaxed text-stone-400">
                注文が入るとここに表示されます
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] leading-none" style={{ color: POS_ACCENT }}>
              {today.count} 取引
            </p>
            <p
              className="mt-0.5 text-[18px] font-bold leading-none tabular-nums"
              style={{ color: POS_ACCENT }}
            >
              {formatYen(today.total)}
            </p>
          </div>
          <span className="shrink-0 text-[16px] font-light text-[#c7c7cc]">›</span>
        </Link>
      )}

      {!loading && !error && data?.months.map((m) => (
        <HistoryMonthRow
          key={m.month}
          month={m.month}
          count={m.count}
          total={m.total}
          href={`/waiter/history/${m.month}`}
        />
      ))}
      {!loading && !error && (data?.months.length ?? 0) === 0 && (
        <p className="p-8 text-center text-[15px] text-stone-500">取引データがありません</p>
      )}
    </div>
  );
}
