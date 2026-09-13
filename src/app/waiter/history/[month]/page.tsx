"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { HistoryDayRow } from "@/components/waiter/history-row";
import { formatYen } from "@/lib/format";
import { waiterFetch } from "@/lib/waiter-api";

type DayRow = {
  date: string;
  count: number;
  total: number;
  isClosedDay: boolean;
};

type MonthData = {
  month: string;
  summary: { count: number; total: number };
  days: DayRow[];
};

export default function WaiterHistoryMonthPage() {
  const params = useParams();
  const month = params.month as string;
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await waiterFetch(`/api/waiter/history?month=${month}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "取引履歴の読み込みに失敗しました");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("取引履歴の読み込みに失敗しました");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white">
      <WaiterHeader title={month} backHref="/waiter/history" onRefresh={() => void load()} />
      {loading && <p className="p-8 text-center text-stone-400">読み込み中…</p>}
      {error && <p className="p-8 text-center text-[14px] text-red-600">{error}</p>}
      {data && (
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2 text-[13px]">
          <span className="text-stone-500">月合計 {data.summary.count}取引</span>
          <span className="font-bold tabular-nums text-[var(--pos-accent)]">
            {formatYen(data.summary.total)}
          </span>
        </div>
      )}
      {data && data.days.length === 0 && !loading && !error && (
        <p className="p-8 text-center text-[14px] text-stone-400">この月の取引はありません</p>
      )}
      {data?.days.map((r) => (
        <HistoryDayRow
          key={r.date}
          date={r.date}
          count={r.count}
          total={r.total}
          isClosedDay={r.isClosedDay}
          href={`/waiter/history/${month}/${r.date}`}
        />
      ))}
    </div>
  );
}
