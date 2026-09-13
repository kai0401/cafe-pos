import Link from "next/link";
import { getDashboardBundle } from "@/domain/analytics/pl-analytics-service";
import {
  EatInPieChart,
  HourlyBarChart,
  PaymentPieChart,
  ProductBarChart,
  ProfitLossComboChart,
  RatioGauge,
  SalesLineChart,
  WeekdayBarChart,
} from "@/components/charts/sales-charts";
import { ExpenseCategoryPieChart } from "@/components/admin/expense-pie-chart";
import { EmptyState, KpiCard, PageHeader } from "@/components/admin/ui";
import { EXPENSE_CATEGORY_LABELS, formatPercent, formatYen, PAYMENT_LABELS } from "@/lib/format";
import { getDefaultStore } from "@/lib/prisma";

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="admin-title admin-brand-serif text-base">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  let data;
  let loadError: string | null = null;
  try {
    const store = await getDefaultStore();
    data = await getDashboardBundle(store.id);
  } catch (error) {
    console.error("[dashboard] load failed:", error);
    loadError =
      error instanceof Error ? error.message : "ダッシュボードの読み込みに失敗しました";
  }

  if (loadError) {
    return (
      <>
        <PageHeader eyebrow="DASHBOARD" title="経営ダッシュボード" description="売上・経費・損益の一元管理" />
        <div className="admin-card p-10 text-center">
          <p className="font-medium text-[var(--admin-vermillion)]">データの読み込みに失敗しました</p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">{loadError}</p>
          <p className="mt-5 text-sm text-[var(--admin-muted)]">
            ページを再読み込みするか、
            <Link
              href="/admin/imports"
              className="font-medium text-[var(--admin-accent)] underline-offset-4 hover:underline"
            >
              CSVインポート
            </Link>
            を確認してください。
          </p>
        </div>
      </>
    );
  }

  if (!data || data.summary.totals.sales === 0) {
    return (
      <>
        <PageHeader eyebrow="DASHBOARD" title="経営ダッシュボード" description="売上・経費・損益の一元管理" />
        <EmptyState message="データがありません。CSVをインポートしてください。" />
      </>
    );
  }

  const { displayMonth: pl, displayPrevMonth: prevPl, comparisons: cmp, displayMonthIsFallback } = data;
  const paymentData = data.summary.payments.map((p) => ({
    label: PAYMENT_LABELS[p.method] ?? p.method,
    amount: p.amount,
  }));

  const plChartData = data.plTrend.map((m) => ({
    label: m.label.replace(/年(\d+)月/, "/$1"),
    revenue: m.revenue,
    expenses: m.expenses + m.cogs,
    profit: m.operatingProfit,
  }));

  const plRows: { label: string; amount: number; strong?: boolean }[] = [
    { label: "売上高", amount: pl.revenue },
    { label: "売上原価（商品原価）", amount: -pl.cogs },
    { label: "粗利益", amount: pl.grossProfit, strong: true },
    { label: "経費合計", amount: -pl.expenses },
    { label: "営業利益", amount: pl.operatingProfit, strong: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="DASHBOARD"
        title="経営ダッシュボード"
        description={`${data.store.name} ／ ${data.store.openTime}–${data.store.closeTime} ／ 売上・経費・損益の一元管理`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/expenses/scan" className="admin-btn admin-btn--accent">
            レシート撮影
          </Link>
          <Link href="/admin/expenses" className="admin-btn admin-btn--ghost">
            経費を登録
          </Link>
          <Link href="/admin/imports" className="admin-btn admin-btn--ghost">
            CSVインポート
          </Link>
        </div>
      </PageHeader>

      {displayMonthIsFallback && (
        <div className="mb-4 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-accent-soft)] px-5 py-3 text-sm leading-relaxed text-[var(--admin-ink)]">
          <strong>{data.summary.month.label}</strong>の売上データはまだありません。
          最新の取込データ（<strong>{pl.label}</strong>）を表示しています。
          累計売上 {formatYen(data.summary.totals.sales)} は全期間の合計です。
        </div>
      )}

      {/* 本日リアルタイム */}
      {(data.todayPos.salesCount > 0 || data.todayPos.openOrderCount > 0) && (
        <div className="admin-card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
          <span className="admin-tag admin-tag--sage">本日（自前POS）</span>
          <span className="admin-brand-serif text-xl text-[var(--admin-ink)]">
            {formatYen(data.todayPos.netTotal)}
          </span>
          <span className="text-sm text-[var(--admin-muted)]">
            {data.todayPos.salesCount}件 / {data.todayPos.customerCount}人
          </span>
          {data.todayPos.openOrderCount > 0 && (
            <span className="text-sm font-medium text-[var(--admin-vermillion)]">
              未会計 {data.todayPos.openOrderCount}テーブル
            </span>
          )}
          <Link
            href="/admin/closing"
            className="ml-auto text-sm font-medium text-[var(--admin-accent)] underline-offset-4 hover:underline"
          >
            レジ締めへ →
          </Link>
        </div>
      )}

      {/* 月次KPI（損益中心） */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={displayMonthIsFallback ? `売上（${pl.label}）` : "今月売上"}
          value={formatYen(pl.revenue)}
          change={cmp.revenueMoM}
          sub={`前月 ${formatYen(prevPl.revenue)}`}
        />
        <KpiCard
          title={displayMonthIsFallback ? `粗利益（${pl.label}）` : "今月粗利益"}
          value={formatYen(pl.grossProfit)}
          sub={`粗利率 ${pl.grossMargin}%（原価データ ${pl.cogsCoverage}%）`}
        />
        <KpiCard
          title={displayMonthIsFallback ? `経費（${pl.label}）` : "今月経費"}
          value={formatYen(pl.expenses)}
          change={cmp.expenseMoM}
          sub={pl.expenses === 0 ? "経費未登録 → 登録してください" : `${pl.expenseByCategory.length}カテゴリ`}
        />
        <KpiCard
          title={displayMonthIsFallback ? `営業利益（${pl.label}）` : "今月営業利益"}
          value={formatYen(pl.operatingProfit)}
          change={cmp.profitMoM}
          sub={`営業利益率 ${pl.operatingMargin}%`}
        />
      </div>

      {/* 累計・客単価 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="累計売上"
          value={formatYen(data.summary.totals.sales)}
          sub={`${data.summary.totals.orders.toLocaleString()}件 / ${data.summary.totals.customers.toLocaleString()}人`}
        />
        <KpiCard title="客単価" value={formatYen(data.summary.totals.avgSpend)} />
        <KpiCard
          title={`${data.summary.month.label}売上`}
          value={formatYen(data.summary.month.sales)}
          change={data.summary.month.hasData ? data.summary.month.vsPrevMonth : null}
          sub={data.summary.month.hasData ? undefined : "今月のデータなし"}
        />
        {data.summary.latestBusinessDay && (
          <KpiCard
            title={`最新営業日（${data.summary.latestBusinessDay.date}）`}
            value={formatYen(data.summary.latestBusinessDay.sales)}
            change={data.summary.latestBusinessDay.vsPreviousDay}
            sub={`${data.summary.latestBusinessDay.customers}人`}
          />
        )}
      </div>

      {/* 損益計算書 + コスト比率 */}
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <SectionCard title={`損益計算書（${pl.label}${displayMonthIsFallback ? "・最新" : ""}）`}>
          <div className="divide-y divide-[var(--admin-line)]/60">
            {plRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between py-2.5 text-sm">
                <span className={row.strong ? "font-medium text-[var(--admin-ink)]" : "text-[var(--admin-muted)]"}>
                  {row.label}
                </span>
                <span
                  className={`tabular-nums ${
                    row.strong
                      ? "font-semibold text-[var(--admin-ink)]"
                      : row.amount < 0
                        ? "text-[var(--admin-vermillion)]"
                        : "text-[var(--admin-ink)]"
                  }`}
                >
                  {formatYen(row.amount)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--admin-muted)]">
            売上原価は取引明細の原価から自動算出。経費は
            <Link
              href="/admin/expenses"
              className="text-[var(--admin-accent)] underline-offset-4 hover:underline"
            >
              経費管理
            </Link>
            で登録。
          </p>
        </SectionCard>

        <SectionCard title="コスト比率（飲食店KPI）">
          <div className="space-y-5">
            <RatioGauge
              label="食材費率（原価+仕入経費）"
              value={data.benchmarks.foodCostRatio}
              target={data.benchmarks.targetFoodCost}
            />
            <RatioGauge
              label="人件費率"
              value={data.benchmarks.laborCostRatio}
              target={data.benchmarks.targetLaborCost}
            />
            {data.benchmarks.shiftLaborCost > 0 && (
              <p className="text-xs text-[var(--admin-muted)]">
                シフト見込み {formatYen(data.benchmarks.shiftLaborCost)}
                {data.benchmarks.manualLaborExpense > 0 &&
                  ` + 経費登録 ${formatYen(data.benchmarks.manualLaborExpense)}`}
              </p>
            )}
            <RatioGauge label="家賃率" value={data.benchmarks.rentCostRatio} target={10} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--admin-muted)]">
            目標値は一般的な喫茶店の目安（食材35%・人件費30%・家賃10%）。赤茶は目標超過。
          </p>
        </SectionCard>

        <SectionCard
          title={`経費内訳（${pl.label}${displayMonthIsFallback ? "・最新" : ""}）`}
          action={
            <Link
              href="/admin/expenses/scan"
              className="shrink-0 text-xs text-[var(--admin-accent)] underline-offset-4 hover:underline"
            >
              レシート撮影 →
            </Link>
          }
        >
          {pl.expenseByCategory.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-[var(--admin-muted)]">経費が未登録です</p>
              <Link
                href="/admin/expenses/scan"
                className="mt-2 inline-block text-sm font-medium text-[var(--admin-accent)] underline-offset-4 hover:underline"
              >
                レシートを撮影して登録
              </Link>
            </div>
          ) : (
            <ExpenseCategoryPieChart data={pl.expenseByCategory} />
          )}
        </SectionCard>
      </div>

      {/* 損益トレンド */}
      <section className="admin-card mt-6 p-6">
        <h2 className="admin-title admin-brand-serif text-base">売上・経費・利益の推移（直近6ヶ月）</h2>
        <p className="mb-4 mt-1 text-xs text-[var(--admin-muted)]">
          経費には売上原価を含む。折れ線が営業利益
        </p>
        <ProfitLossComboChart data={plChartData} />
      </section>

      {/* 売上分析 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="売上推移（日別・直近60日）">
          <SalesLineChart data={data.daily} />
        </SectionCard>
        <SectionCard title="時間帯別売上">
          <HourlyBarChart data={data.hourly.filter((h) => h.sales > 0)} />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard title="曜日別売上">
          <WeekdayBarChart data={data.weekday.map((w) => ({ label: w.label, sales: w.sales }))} />
        </SectionCard>
        <SectionCard title="イートイン / テイクアウト">
          <EatInPieChart dineIn={data.eatInSplit.dineIn} takeout={data.eatInSplit.takeout} />
          <p className="mt-2 text-center text-xs text-[var(--admin-muted)]">
            イートイン {data.eatInSplit.dineInRatio}% / テイクアウト {data.eatInSplit.takeoutRatio}%
          </p>
        </SectionCard>
        <SectionCard title="支払い方法別">
          <PaymentPieChart data={paymentData} />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="商品別 TOP10">
          <ProductBarChart data={data.products.map((p) => ({ name: p.name, sales: p.sales }))} />
        </SectionCard>

        <SectionCard
          title="最近の経費"
          action={
            <Link
              href="/admin/expenses"
              className="shrink-0 text-sm text-[var(--admin-accent)] underline-offset-4 hover:underline"
            >
              すべて見る →
            </Link>
          }
        >
          {data.recentExpenses.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--admin-muted)]">
              経費を登録するとここに表示されます
            </p>
          ) : (
            <div className="divide-y divide-[var(--admin-line)]/60">
              {data.recentExpenses.map((e) => (
                <div key={e.id} className="flex justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-[var(--admin-ink)]">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {e.expenseDate.toISOString().slice(0, 10)}
                      {e.description && ` · ${e.description}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-[var(--admin-vermillion)]">
                    {formatYen(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 前月比較サマリー */}
      <SectionCard className="mt-6" title={`前月比較（${prevPl.label} → ${pl.label}）`}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "売上", cur: pl.revenue, prev: prevPl.revenue, change: cmp.revenueMoM },
            { label: "経費", cur: pl.expenses, prev: prevPl.expenses, change: cmp.expenseMoM },
            { label: "営業利益", cur: pl.operatingProfit, prev: prevPl.operatingProfit, change: cmp.profitMoM },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-[var(--admin-line)]/70 bg-[var(--admin-paper)] p-4"
            >
              <p className="admin-label !mb-1">{row.label}</p>
              <p className="admin-brand-serif mt-1 text-xl text-[var(--admin-ink)]">
                {formatYen(row.cur)}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">前月 {formatYen(row.prev)}</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  row.change == null
                    ? "text-[var(--admin-muted)]"
                    : row.change >= 0
                      ? "text-[var(--admin-sage)]"
                      : "text-[var(--admin-vermillion)]"
                }`}
              >
                {formatPercent(row.change)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
