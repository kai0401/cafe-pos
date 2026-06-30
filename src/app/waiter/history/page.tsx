"use client";

import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { HistoryMonthRow } from "@/components/waiter/history-row";

type MonthRow = { month: string; count: number; total: number };

export default function WaiterHistoryPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/waiter/history")
      .then((r) => r.json())
      .then((data) => {
        setMonths(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <WaiterHeader title="取引履歴" backHref="/waiter" />
      {loading && <p className="p-8 text-center text-[15px] text-stone-400">読み込み中…</p>}
      {!loading && months.map((m) => (
        <HistoryMonthRow
          key={m.month}
          month={m.month}
          count={m.count}
          total={m.total}
          href={`/waiter/history/${m.month}`}
        />
      ))}
      {!loading && months.length === 0 && (
        <p className="p-8 text-center text-[15px] text-stone-500">取引データがありません</p>
      )}
    </div>
  );
}
