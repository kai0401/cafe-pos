"use client";

import { formatPercent, formatYen } from "@/lib/format";
import type { ProfitLossGrade } from "@/domain/analytics/analytics-service";
import { ProfitLossCategoryChart, ProfitLossDailyChart } from "@/components/admin/profit-loss-charts";

export type ProfitLossReportData = {
  store: string;
  period: string;
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  marginPercent: number;
  grade: ProfitLossGrade;
  prevRevenue: number;
  revenueChange: number | null;
  profitChange: number | null;
  businessDays: number;
  customers: number;
  avgDailyRevenue: number;
  avgSpend: number;
  costCoverage: number;
  targetRevenue: number;
  targetProgress: number;
  categories: {
    name: string;
    revenue: number;
    cost: number;
    quantity: number;
    profit: number;
    marginPercent: number;
  }[];
  daily: {
    date: string;
    dayOfWeek: string;
    revenue: number;
    customers: number;
  }[];
};

const GRADE_META: Record<ProfitLossGrade, { title: string; desc: string }> = {
  S: { title: "卓越", desc: "粗利率 70% 以上" },
  A: { title: "優良", desc: "粗利率 60% 以上" },
  B: { title: "安定", desc: "粗利率 50% 以上" },
  C: { title: "標準", desc: "粗利率 40% 以上" },
  D: { title: "要改善", desc: "粗利率 40% 未満" },
};

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pl-frame relative p-6 md:p-7 ${className}`}>
      <div className="pl-frame-corners" aria-hidden>
        <span />
        <span />
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pl-section-title mb-6">{children}</h2>;
}

function GaugeRow({
  label,
  value,
  display,
  max,
  variant,
}: {
  label: string;
  value: number;
  display: string;
  max: number;
  variant: "revenue" | "cost" | "profit";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="pl-metric-label">{label}</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-[#f3ece0]">{display}</span>
      </div>
      <div className="pl-gauge-track">
        <div className={`pl-gauge-fill pl-gauge-fill--${variant}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#9a9288]">—</span>;
  const up = value >= 0;
  return (
    <span className={`pl-delta ${up ? "pl-delta--up" : "pl-delta--down"}`}>
      {up ? "▲" : "▼"} {formatPercent(value)}
    </span>
  );
}

export function ProfitLossGameReport({ report }: { report: ProfitLossReportData }) {
  const meta = GRADE_META[report.grade];
  const maxGauge = Math.max(report.revenue, report.costOfGoods, report.grossProfit, 1);
  const maxDaily = Math.max(...report.daily.map((d) => d.revenue), 1);

  return (
    <>
      {/* ヘッダー */}
      <header className="mb-10 text-center">
        <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-[#8a7340]">MONTHLY P&amp;L</p>
        <h1 className="mt-3 text-3xl font-bold tracking-wide text-[#f3ece0] md:text-4xl">損益決算書</h1>
        <p className="mt-3 text-sm text-[#9a9288]">
          {report.store}
          <span className="mx-2 text-[#2a241c]">|</span>
          {report.period}
          <span className="mx-2 text-[#2a241c]">|</span>
          営業 {report.businessDays} 日
        </p>
      </header>

      {/* ヒーロー: 紋章 + 主要数値 */}
      <div className="mb-8 grid gap-6 lg:grid-cols-[13rem_1fr]">
        <Frame className="flex flex-col items-center justify-center py-8">
          <div className="pl-rank-emblem">
            <div className="pl-rank-emblem-ring" aria-hidden />
            <div className="pl-rank-emblem-core">
              <span className="pl-rank-letter">{report.grade}</span>
              <span className="pl-rank-title">{meta.title}</span>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-[#9a9288]">{meta.desc}</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#6ecf9a]">
            {report.marginPercent}%
          </p>
          <p className="text-[0.65rem] tracking-wider text-[#8a7340]">粗利率</p>
        </Frame>

        <Frame>
          <SectionTitle>収支サマリー</SectionTitle>
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="pl-metric-label">売上高</p>
              <p className="pl-metric-hero mt-2 text-[#e8b84a]">{formatYen(report.revenue)}</p>
              <div className="mt-3">
                <DeltaBadge value={report.revenueChange} />
              </div>
            </div>
            <div>
              <p className="pl-metric-label">売上原価</p>
              <p className="pl-metric-hero mt-2 text-[#d47373]">{formatYen(report.costOfGoods)}</p>
              <p className="mt-3 text-xs text-[#9a9288]">
                原価データ {report.costCoverage}%
              </p>
            </div>
            <div>
              <p className="pl-metric-label">粗利益</p>
              <p className="pl-metric-hero mt-2 text-[#6ecf9a]">{formatYen(report.grossProfit)}</p>
              <div className="mt-3">
                <DeltaBadge value={report.profitChange} />
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4 border-t border-[#2a241c] pt-8">
            <GaugeRow
              label="売上高"
              value={report.revenue}
              max={maxGauge}
              display={formatYen(report.revenue)}
              variant="revenue"
            />
            <GaugeRow
              label="売上原価"
              value={report.costOfGoods}
              max={maxGauge}
              display={formatYen(report.costOfGoods)}
              variant="cost"
            />
            <GaugeRow
              label="粗利益"
              value={Math.max(0, report.grossProfit)}
              max={maxGauge}
              display={formatYen(report.grossProfit)}
              variant="profit"
            />
          </div>
        </Frame>
      </div>

      {/* 補助指標 + 目標 */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Frame>
          <SectionTitle>営業指標</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              ["1日平均売上", formatYen(report.avgDailyRevenue)],
              ["客数", `${report.customers.toLocaleString()} 人`],
              ["客単価", formatYen(report.avgSpend)],
              ["前月売上", formatYen(report.prevRevenue)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="pl-metric-label">{label}</dt>
                <dd className="mt-1 font-mono text-base font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Frame>

        <Frame>
          <SectionTitle>月間目標</SectionTitle>
          <p className="mb-1 text-xs text-[#9a9288]">前月比 +5% を目標ラインとする</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <span className="font-mono text-3xl font-bold tabular-nums text-[#f0d78c]">
              {report.targetProgress}%
            </span>
            <span className="text-right text-xs text-[#9a9288]">
              目標 {formatYen(report.targetRevenue)}
              <br />
              実績 {formatYen(report.revenue)}
            </span>
          </div>
          <div className="pl-gauge-track mt-4 h-2">
            <div
              className="pl-gauge-fill pl-gauge-fill--target h-2"
              style={{ width: `${report.targetProgress}%` }}
            />
          </div>
        </Frame>
      </div>

      {/* チャート */}
      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Frame>
          <SectionTitle>日別売上推移</SectionTitle>
          <ProfitLossDailyChart data={report.daily} />
        </Frame>
        <Frame>
          <SectionTitle>部門別粗利</SectionTitle>
          <ProfitLossCategoryChart data={report.categories} />
        </Frame>
      </div>

      {/* 部門明細 */}
      <Frame className="mb-8">
        <SectionTitle>部門別内訳</SectionTitle>
        <div className="divide-y divide-[#2a241c]">
          {report.categories.map((cat, i) => (
            <div key={cat.name} className="pl-category-row">
              <div className="flex min-w-0 items-center gap-3">
                <span className="pl-category-rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#f3ece0]">{cat.name}</p>
                  <p className="text-xs text-[#9a9288]">{cat.quantity.toLocaleString()} 点</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right font-mono text-xs tabular-nums sm:gap-6 sm:text-sm">
                <div>
                  <p className="text-[0.6rem] text-[#8a7340]">売上</p>
                  <p className="text-[#e8b84a]">{formatYen(cat.revenue)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-[#8a7340]">原価</p>
                  <p className="text-[#d47373]">{formatYen(cat.cost)}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-[#8a7340]">粗利</p>
                  <p className="text-[#6ecf9a]">{formatYen(cat.profit)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Frame>

      {/* 日別一覧 */}
      <Frame className="mb-8">
        <SectionTitle>日別明細</SectionTitle>
        <div className="max-h-80 overflow-y-auto pr-1">
          {[...report.daily].reverse().map((day) => (
            <div key={day.date} className="pl-day-row">
              <span className="font-mono text-xs text-[#8a7340]">{day.date.slice(5)}</span>
              <span className="text-center text-xs font-medium text-[#9a9288]">{day.dayOfWeek}</span>
              <div className="pl-day-bar-wrap">
                <div
                  className="pl-day-bar"
                  style={{ width: `${(day.revenue / maxDaily) * 100}%` }}
                />
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-semibold tabular-nums text-[#f0d78c]">
                  {formatYen(day.revenue)}
                </span>
                <span className="ml-2 text-xs text-[#9a9288]">{day.customers}人</span>
              </div>
            </div>
          ))}
        </div>
      </Frame>

      <div className="flex justify-end print:hidden">
        <button type="button" onClick={() => window.print()} className="pl-print-btn">
          印刷
        </button>
      </div>
    </>
  );
}
