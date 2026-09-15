"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RemoteShell, monthLabel, yen, REMOTE_TEAL } from "@/components/remote/remote-ui";
import { remoteFetch } from "@/lib/remote-api";

type DayRow = { date: string; count: number; total: number; isClosedDay: boolean };
type MonthPayload = {
  month: string;
  summary: { count: number; total: number };
  days: DayRow[];
};

export default function RemoteMonthPage() {
  const params = useParams();
  const month = params.month as string;
  const [data, setData] = useState<MonthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await remoteFetch(`/api/waiter/history?month=${encodeURIComponent(month)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "月次データの取得に失敗しました");
        return;
      }
      setData(json);
    } catch {
      setError("接続に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RemoteShell title={monthLabel(month)} backHref="/remote">
      {loading && <p className="py-12 text-center text-stone-400">読み込み中…</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      {data && (
        <>
          <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[13px] text-stone-500">月合計</p>
            <p className="mt-1 text-[28px] font-bold tabular-nums" style={{ color: REMOTE_TEAL }}>
              {yen(data.summary.total)}
            </p>
            <p className="mt-1 text-[14px] text-stone-600">{data.summary.count} 件</p>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {data.days
              .filter((d) => d.count > 0 || !d.isClosedDay)
              .map((d) => (
                <Link
                  key={d.date}
                  href={`/remote/day/${d.date}`}
                  className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-b-0 active:bg-stone-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-stone-900">{d.date.slice(5)}</p>
                    {d.isClosedDay && d.count === 0 ? (
                      <p className="text-[12px] text-stone-400">定休日</p>
                    ) : (
                      <p className="text-[12px] text-stone-500">{d.count} 件</p>
                    )}
                  </div>
                  <p className="text-[16px] font-bold tabular-nums text-stone-900">
                    {d.count > 0 ? yen(d.total) : "—"}
                  </p>
                  <span className="text-stone-300">›</span>
                </Link>
              ))}
          </div>
        </>
      )}
    </RemoteShell>
  );
}
