"use client";

import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { HistoryMonthRow } from "@/components/waiter/history-row";
import { waiterFetch } from "@/lib/waiter-api";

type MonthRow = { month: string; count: number; total: number };

export default function WaiterHistoryPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    waiterFetch("/api/waiter/history")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "取引履歴の読み込みに失敗しました");
          return;
        }
        if (!Array.isArray(data)) {
          setError("取引データの形式が不正です");
          return;
        }
        setMonths(data);
      })
      .catch(() => setError("取引履歴の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <WaiterHeader title="取引履歴" backHref="/waiter" />
      {loading && <p className="p-8 text-center text-[15px] text-stone-400">読み込み中…</p>}
      {error && <p className="p-8 text-center text-[15px] text-red-600">{error}</p>}
      {!loading && !error && months.map((m) => (
        <HistoryMonthRow
          key={m.month}
          month={m.month}
          count={m.count}
          total={m.total}
          href={`/waiter/history/${m.month}`}
        />
      ))}
      {!loading && !error && months.length === 0 && (
        <p className="p-8 text-center text-[15px] text-stone-500">取引データがありません</p>
      )}
    </div>
  );
}
