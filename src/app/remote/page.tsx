"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RemoteShell, monthLabel, yen } from "@/components/remote/remote-ui";
import { remoteFetch } from "@/lib/remote-api";
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

export default function RemoteHomePage() {
  const [data, setData] = useState<HistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await remoteFetch("/api/waiter/history");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "売上データの取得に失敗しました");
        setData(null);
        return;
      }
      if (!json?.today || !Array.isArray(json.months)) {
        setError("データの形式が不正です");
        setData(null);
        return;
      }
      setData(json);
      setSource(typeof window !== "undefined" && window.location.hostname.includes("vercel")
        ? "店舗サーバー（遠隔）"
        : "店舗サーバー（店内）");
    } catch {
      setError("接続に失敗しました");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = data?.today;

  return (
    <RemoteShell
      title="売上ダッシュボード"
      right={
        <button type="button" onClick={() => void load()} className="text-[14px] text-white/90">
          更新
        </button>
      }
    >
      {source && <p className="mb-3 text-[12px] text-stone-500">{source}</p>}

      {loading && <p className="py-12 text-center text-[15px] text-stone-400">読み込み中…</p>}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {today && (
        <Link
          href={`/remote/day/${today.date}`}
          className="mb-4 block rounded-2xl bg-white p-5 shadow-sm active:scale-[0.99]"
        >
          <p className="text-[13px] font-medium text-stone-500">本日の売上 · {today.date}</p>
          <p className="mt-2 text-[32px] font-bold tabular-nums tracking-tight" style={{ color: POS_ACCENT }}>
            {yen(today.total)}
          </p>
          <p className="mt-1 text-[14px] text-stone-600">
            {today.count} 件
            {today.openCount > 0
              ? ` · 未会計 ${today.openCount}件${typeof today.openTotal === "number" ? `（${yen(today.openTotal)}）` : ""}`
              : ""}
          </p>
          <p className="mt-3 text-[13px] font-medium" style={{ color: POS_ACCENT }}>
            取引明細を見る →
          </p>
        </Link>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-stone-800">月次売上</h2>
        <Link href="/monitor" className="text-[13px] text-stone-500 underline">
          店舗モニター
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {!loading && !error && data?.months.length === 0 && (
          <p className="px-4 py-8 text-center text-[14px] text-stone-400">まだ売上がありません</p>
        )}
        {data?.months.map((m) => (
          <Link
            key={m.month}
            href={`/remote/month/${m.month}`}
            className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5 last:border-b-0 active:bg-stone-50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-stone-900">{monthLabel(m.month)}</p>
              <p className="text-[12px] text-stone-500">{m.count} 件</p>
            </div>
            <p className="text-[17px] font-bold tabular-nums text-stone-900">{yen(m.total)}</p>
            <span className="text-stone-300">›</span>
          </Link>
        ))}
      </div>
    </RemoteShell>
  );
}
