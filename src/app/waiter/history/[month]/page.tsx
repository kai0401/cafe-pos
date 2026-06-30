"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { HistoryDayRow } from "@/components/waiter/history-row";

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

  const load = useCallback(() => {
    fetch(`/api/waiter/history?month=${month}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white">
      <WaiterHeader title={month} backHref="/waiter/history" onRefresh={load} />
      {data?.days.map((r) => (
        <HistoryDayRow
          key={r.date}
          date={r.date}
          count={r.count}
          total={r.total}
          isClosedDay={r.isClosedDay}
        />
      ))}
    </div>
  );
}
