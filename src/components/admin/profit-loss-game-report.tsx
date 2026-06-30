"use client";

import { formatPercent, formatYen } from "@/lib/format";
import type { ProfitLossGrade } from "@/domain/analytics/analytics-service";

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

const GRADE_STYLE: Record<
  ProfitLossGrade,
  { label: string; ring: string; glow: string; badge: string }
> = {
  S: {
    label: "伝説の店長",
    ring: "from-amber-300 via-yellow-200 to-amber-500",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.55)]",
    badge: "bg-gradient-to-br from-amber-400 to-yellow-600 text-amber-950",
  },
  A: {
    label: "熟練バリスタ",
    ring: "from-violet-300 via-purple-200 to-fuchsia-400",
    glow: "shadow-[0_0_36px_rgba(167,139,250,0.5)]",
    badge: "bg-gradient-to-br from-violet-400 to-purple-600 text-white",
  },
  B: {
    label: "安定経営",
    ring: "from-sky-300 via-cyan-200 to-blue-400",
    glow: "shadow-[0_0_32px_rgba(56,189,248,0.45)]",
    badge: "bg-gradient-to-br from-sky-400 to-blue-600 text-white",
  },
  C: {
    label: "成長途中",
    ring: "from-emerald-300 via-green-200 to-teal-400",
    glow: "shadow-[0_0_28px_rgba(52,211,153,0.4)]",
    badge: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
  },
  D: {
    label: "要強化",
    ring: "from-stone-400 via-stone-300 to-stone-500",
    glow: "shadow-[0_0_24px_rgba(120,113,108,0.35)]",
    badge: "bg-gradient-to-br from-stone-500 to-stone-700 text-stone-100",
  },
};

const CATEGORY_ICON: Record<string, string> = {
  あんみつ: "🍨",
  ソフトクリーム: "🍦",
  ドリンク: "☕",
  氷: "🧊",
  シロップ: "🍯",
  軽食: "🍝",
};

function GamePanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-[#1a1528]/90 p-5 backdrop-blur-sm ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-widest text-amber-200/90 uppercase">
        <span className="inline-block h-2 w-2 rotate-45 bg-amber-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
  display,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-violet-200/80">{label}</span>
        <span className="font-mono text-sm font-bold text-white">{display}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ProfitLossGameReport({ report }: { report: ProfitLossReportData }) {
  const grade = GRADE_STYLE[report.grade];
  const maxStat = Math.max(report.revenue, report.costOfGoods, report.grossProfit, 1);

  return (
    <div className="profit-loss-game -mx-2 rounded-3xl bg-gradient-to-b from-[#0f0a1f] via-[#1a1230] to-[#0d0818] p-4 text-white sm:-mx-4 sm:p-6 md:p-8">
      {/* Victory banner */}
      <div className="relative mb-8 text-center">
        <div className="mx-auto inline-block rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1 text-xs font-bold tracking-[0.3em] text-amber-200">
          MONTHLY RESULT
        </div>
        <h1 className="mt-3 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          損益リポート
        </h1>
        <p className="mt-2 text-sm text-violet-200/70">
          {report.store} · {report.period} · 営業 {report.businessDays} 日
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Rank badge — gacha / RPG result style */}
        <div className="flex flex-col items-center justify-center">
          <div
            className={`relative flex h-44 w-44 items-center justify-center rounded-full border-4 border-white/20 bg-gradient-to-br ${grade.ring} ${grade.glow}`}
          >
            <div className={`flex h-36 w-36 flex-col items-center justify-center rounded-full ${grade.badge}`}>
              <span className="text-6xl font-black leading-none">{report.grade}</span>
              <span className="mt-1 text-[11px] font-bold tracking-wider">{grade.label}</span>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-violet-200/80">
            粗利率 <span className="font-bold text-emerald-300">{report.marginPercent}%</span>
          </p>
          {report.revenueChange !== null && (
            <p
              className={`mt-1 text-xs font-semibold ${report.revenueChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              売上 {formatPercent(report.revenueChange)} / 粗利 {formatPercent(report.profitChange)}
            </p>
          )}
        </div>

        {/* Core stats — RPG status window */}
        <GamePanel title="ステータス">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-500/20 bg-black/30 p-4 text-center">
              <p className="text-[10px] font-bold tracking-widest text-amber-300/80">REVENUE</p>
              <p className="mt-1 font-mono text-2xl font-black text-amber-300">{formatYen(report.revenue)}</p>
              <p className="mt-1 text-xs text-violet-300/60">売上高</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-black/30 p-4 text-center">
              <p className="text-[10px] font-bold tracking-widest text-rose-300/80">COST</p>
              <p className="mt-1 font-mono text-2xl font-black text-rose-300">{formatYen(report.costOfGoods)}</p>
              <p className="mt-1 text-xs text-violet-300/60">売上原価</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-black/30 p-4 text-center">
              <p className="text-[10px] font-bold tracking-widest text-emerald-300/80">PROFIT</p>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-300">{formatYen(report.grossProfit)}</p>
              <p className="mt-1 text-xs text-violet-300/60">粗利益</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <StatBar
              label="売上"
              value={report.revenue}
              max={maxStat}
              color="bg-gradient-to-r from-amber-600 to-amber-300"
              display={formatYen(report.revenue)}
            />
            <StatBar
              label="原価"
              value={report.costOfGoods}
              max={maxStat}
              color="bg-gradient-to-r from-rose-700 to-rose-400"
              display={formatYen(report.costOfGoods)}
            />
            <StatBar
              label="粗利"
              value={Math.max(0, report.grossProfit)}
              max={maxStat}
              color="bg-gradient-to-r from-emerald-700 to-emerald-400"
              display={formatYen(report.grossProfit)}
            />
          </div>

          {/* Quest progress — monthly target */}
          <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-950/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-violet-200">🎯 月間クエスト（前月比+5%）</span>
              <span className="font-mono text-amber-200">{report.targetProgress}%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-black/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400 transition-all duration-1000"
                style={{ width: `${report.targetProgress}%` }}
              />
            </div>
            <p className="mt-2 text-right text-[11px] text-violet-300/60">
              目標 {formatYen(report.targetRevenue)} / 達成 {formatYen(report.revenue)}
            </p>
          </div>
        </GamePanel>
      </div>

      {/* Sub stats row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { icon: "📅", label: "1日平均", value: formatYen(report.avgDailyRevenue) },
          { icon: "👥", label: "客数", value: `${report.customers.toLocaleString()}人` },
          { icon: "🪙", label: "客単価", value: formatYen(report.avgSpend) },
          { icon: "📦", label: "原価データ", value: `${report.costCoverage}%` },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-[10px] font-bold text-violet-300/70">{item.label}</p>
              <p className="font-mono text-sm font-bold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category loot grid */}
      <GamePanel title="カテゴリ別ドロップ（粗利）" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.categories.map((cat, index) => (
            <div
              key={cat.name}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#251d3a] to-[#1a1428] p-4 transition hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            >
              <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs font-black text-amber-300">
                #{index + 1}
              </div>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{CATEGORY_ICON[cat.name] ?? "🧾"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-amber-100">{cat.name}</p>
                  <p className="text-[11px] text-violet-300/60">{cat.quantity.toLocaleString()} 個販売</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="rounded bg-black/30 py-1">
                  <p className="text-violet-400">売上</p>
                  <p className="font-mono font-bold text-amber-200">{formatYen(cat.revenue)}</p>
                </div>
                <div className="rounded bg-black/30 py-1">
                  <p className="text-violet-400">原価</p>
                  <p className="font-mono font-bold text-rose-300">{formatYen(cat.cost)}</p>
                </div>
                <div className="rounded bg-black/30 py-1">
                  <p className="text-violet-400">粗利</p>
                  <p className="font-mono font-bold text-emerald-300">{formatYen(cat.profit)}</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300"
                  style={{ width: `${Math.min(100, cat.marginPercent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GamePanel>

      {/* Daily battle log */}
      <GamePanel title="営業ログ（日別）" className="mt-6">
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {[...report.daily].reverse().map((day) => (
            <div
              key={day.date}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <span className="w-14 font-mono text-xs text-violet-400">{day.date.slice(5)}</span>
                <span className="rounded bg-violet-900/50 px-2 py-0.5 text-xs font-bold text-violet-200">
                  {day.dayOfWeek}
                </span>
                <span className="text-xs text-violet-300/50">{day.customers}人</span>
              </div>
              <span className="font-mono font-bold text-amber-200">{formatYen(day.revenue)}</span>
            </div>
          ))}
        </div>
      </GamePanel>

      <div className="mt-6 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border-2 border-amber-400/50 bg-amber-500/20 px-6 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-500/30"
        >
          🖨 印刷する
        </button>
      </div>
    </div>
  );
}
