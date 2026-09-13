"use client";

import { formatPercent, formatYen } from "@/lib/format";
import type { ProfitLossGrade } from "@/domain/analytics/analytics-service";
import { ProfitLossCategoryChart, ProfitLossDailyChart } from "@/components/admin/profit-loss-charts";
import { PageHeader } from "@/components/admin/ui";

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

const GRADE_LABEL: Record<ProfitLossGrade, string> = {
  S: "粗利率 70% 以上",
  A: "粗利率 60% 以上",
  B: "粗利率 50% 以上",
  C: "粗利率 40% 以上",
  D: "粗利率 40% 未満",
};

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm text-[var(--admin-muted)]">前月比 —</span>;
  const up = value >= 0;
  return (
    <span
      className={`text-sm font-medium ${up ? "text-[var(--admin-sage)]" : "text-[var(--admin-vermillion)]"}`}
    >
      前月比 {up ? "+" : ""}
      {formatPercent(value)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  foot,
}: {
  label: string;
  value: string;
  foot: React.ReactNode;
}) {
  return (
    <div className="admin-card p-5">
      <p className="admin-label">{label}</p>
      <p className="admin-brand-serif text-[1.65rem] leading-tight tracking-tight text-[var(--admin-ink)]">
        {value}
      </p>
      <div className="mt-2">{foot}</div>
    </div>
  );
}

export function ProfitLossReport({ report }: { report: ProfitLossReportData }) {
  const maxDaily = Math.max(...report.daily.map((d) => d.revenue), 1);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="MONTHLY P&L"
        title="損益レポート"
        description={`${report.store} ／ ${report.period} ／ 営業 ${report.businessDays} 日`}
      >
        <button type="button" onClick={() => window.print()} className="admin-btn admin-btn--ghost print:hidden">
          印刷
        </button>
      </PageHeader>

      {/* 収支サマリー */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="売上高"
          value={formatYen(report.revenue)}
          foot={<Delta value={report.revenueChange} />}
        />
        <SummaryCard
          label="売上原価"
          value={formatYen(report.costOfGoods)}
          foot={
            <span className="text-sm text-[var(--admin-muted)]">
              原価データ {report.costCoverage}%
            </span>
          }
        />
        <SummaryCard
          label="粗利益"
          value={formatYen(report.grossProfit)}
          foot={<Delta value={report.profitChange} />}
        />
        <SummaryCard
          label="粗利率"
          value={`${report.marginPercent}%`}
          foot={
            <span className="admin-tag" title={GRADE_LABEL[report.grade]}>
              評価 {report.grade} ・ {GRADE_LABEL[report.grade]}
            </span>
          }
        />
      </div>

      {/* 営業指標 + 月間目標 */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-5 text-base">営業指標</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              ["1日平均売上", formatYen(report.avgDailyRevenue)],
              ["客数", `${report.customers.toLocaleString()} 人`],
              ["客単価", formatYen(report.avgSpend)],
              ["前月売上", formatYen(report.prevRevenue)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="admin-label">{label}</dt>
                <dd className="text-lg font-medium tabular-nums text-[var(--admin-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-2 text-base">月間目標</h2>
          <p className="text-xs text-[var(--admin-muted)]">前月比 +5% を目標ラインとする</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <span className="admin-brand-serif text-3xl tabular-nums text-[var(--admin-ink)]">
              {report.targetProgress}%
            </span>
            <span className="text-right text-xs leading-relaxed text-[var(--admin-muted)]">
              目標 {formatYen(report.targetRevenue)}
              <br />
              実績 {formatYen(report.revenue)}
            </span>
          </div>
          <div className="admin-progress mt-4">
            <span style={{ width: `${Math.min(100, report.targetProgress)}%` }} />
          </div>
        </div>
      </div>

      {/* チャート */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">日別売上推移</h2>
          <ProfitLossDailyChart data={report.daily} />
        </div>
        <div className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">部門別粗利</h2>
          <ProfitLossCategoryChart data={report.categories} />
        </div>
      </div>

      {/* 部門別内訳 */}
      <div className="admin-card mt-6 overflow-x-auto">
        <h2 className="admin-title admin-brand-serif px-6 pt-6 text-base">部門別内訳</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead className="border-b border-[var(--admin-line)] text-left text-[var(--admin-muted)]">
            <tr>
              <th className="px-6 py-3 text-xs font-medium tracking-wider">部門</th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-wider">数量</th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-wider">売上</th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-wider">原価</th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-wider">粗利</th>
              <th className="px-6 py-3 text-right text-xs font-medium tracking-wider">粗利率</th>
            </tr>
          </thead>
          <tbody>
            {report.categories.map((cat) => (
              <tr key={cat.name} className="border-t border-[var(--admin-line)]/60">
                <td className="px-6 py-3 font-medium text-[var(--admin-ink)]">{cat.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--admin-muted)]">
                  {cat.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--admin-ink)]">
                  {formatYen(cat.revenue)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--admin-muted)]">
                  {formatYen(cat.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--admin-ink)]">
                  {formatYen(cat.profit)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-[var(--admin-sage)]">
                  {cat.marginPercent}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 日別明細 */}
      <div className="admin-card mt-6 p-6">
        <h2 className="admin-title admin-brand-serif mb-4 text-base">日別明細</h2>
        <div className="max-h-80 overflow-y-auto pr-1">
          {[...report.daily].reverse().map((day) => (
            <div
              key={day.date}
              className="grid grid-cols-[4.5rem_2rem_1fr_auto] items-center gap-3 border-b border-[var(--admin-line)]/50 py-2.5 text-sm last:border-b-0"
            >
              <span className="tabular-nums text-[var(--admin-muted)]">{day.date.slice(5)}</span>
              <span className="text-center text-xs text-[var(--admin-muted)]">{day.dayOfWeek}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]/60">
                <div
                  className="h-full rounded-full bg-[var(--admin-accent)]/70"
                  style={{ width: `${(day.revenue / maxDaily) * 100}%` }}
                />
              </div>
              <div className="text-right">
                <span className="font-medium tabular-nums text-[var(--admin-ink)]">
                  {formatYen(day.revenue)}
                </span>
                <span className="ml-2 text-xs text-[var(--admin-muted)]">{day.customers}人</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
