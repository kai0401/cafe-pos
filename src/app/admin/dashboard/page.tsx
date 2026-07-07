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
import { EmptyState, KpiCard, PageHeader, StatTable } from "@/components/admin/ui";
import { EXPENSE_CATEGORY_LABELS, formatPercent, formatYen, PAYMENT_LABELS } from "@/lib/format";
import { getDefaultStore } from "@/lib/prisma";

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
        <PageHeader title="経営ダッシュボード" description="売上・経費・損益の一元管理" />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-800">データの読み込みに失敗しました</p>
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
          <p className="mt-4 text-sm text-stone-600">
            ページを再読み込みするか、
            <Link href="/admin/imports" className="font-medium text-amber-700 hover:underline">
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
        <PageHeader title="経営ダッシュボード" description="売上・経費・損益の一元管理" />
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

  const plRows: (string | number)[][] = [
    ["売上高", pl.revenue],
    ["売上原価（商品原価）", -pl.cogs],
    ["粗利益", pl.grossProfit],
    ["経費合計", -pl.expenses],
    ["営業利益", pl.operatingProfit],
  ];

  return (
    <>
      <PageHeader
        title="経営ダッシュボード"
        description={`${data.store.name} / ${data.store.openTime}–${data.store.closeTime} / スマレジ・freee・Square 相当の損益分析`}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/expenses/scan"
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            📷 レシート撮影
          </Link>
          <Link
            href="/admin/expenses"
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            経費を登録
          </Link>
          <Link
            href="/admin/imports"
            className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            CSVインポート
          </Link>
        </div>
      </PageHeader>

      {displayMonthIsFallback && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-900">
          <strong>{data.summary.month.label}</strong>の売上データはまだありません。
          最新の取込データ（<strong>{pl.label}</strong>）を表示しています。
          累計売上 {formatYen(data.summary.totals.sales)} は全期間の合計です。
        </div>
      )}

      {/* 本日リアルタイム */}
      {(data.todayPos.salesCount > 0 || data.todayPos.openOrderCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <span className="text-sm font-semibold text-amber-800">本日（自前POS）</span>
          <span className="text-lg font-bold text-amber-900">{formatYen(data.todayPos.netTotal)}</span>
          <span className="text-sm text-amber-700">
            {data.todayPos.salesCount}件 / {data.todayPos.customerCount}人
          </span>
          {data.todayPos.openOrderCount > 0 && (
            <span className="text-sm text-red-600">未会計 {data.todayPos.openOrderCount}テーブル</span>
          )}
          <Link href="/admin/closing" className="ml-auto text-sm font-medium text-amber-800 underline">
            レジ締めへ
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
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="mb-4 font-semibold text-stone-800">
            損益計算書（{pl.label}{displayMonthIsFallback ? "・最新" : ""}）
          </h2>
          <StatTable
            headers={["項目", "金額"]}
            rows={plRows}
            yenColumns={[1]}
          />
          <p className="mt-3 text-xs text-stone-400">
            売上原価は取引明細の原価から自動算出。経費は
            <Link href="/admin/expenses" className="text-amber-700 underline">
              経費管理
            </Link>
            で登録。
          </p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="mb-4 font-semibold text-stone-800">コスト比率（飲食店KPI）</h2>
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
              <p className="text-xs text-stone-500">
                シフト見込み {formatYen(data.benchmarks.shiftLaborCost)}
                {data.benchmarks.manualLaborExpense > 0 &&
                  ` + 経費登録 ${formatYen(data.benchmarks.manualLaborExpense)}`}
              </p>
            )}
            <RatioGauge label="家賃率" value={data.benchmarks.rentCostRatio} target={10} />
          </div>
          <p className="mt-4 text-xs text-stone-400">
            目標値は一般的な喫茶店の目安（食材35%・人件費30%・家賃10%）。赤は目標超過。
          </p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">
              経費内訳（{pl.label}{displayMonthIsFallback ? "・最新" : ""}）
            </h2>
            <Link href="/admin/expenses/scan" className="text-xs text-amber-700 hover:underline">
              レシート撮影 →
            </Link>
          </div>
          {pl.expenseByCategory.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-stone-400">経費が未登録です</p>
              <Link
                href="/admin/expenses/scan"
                className="mt-2 inline-block text-sm font-medium text-amber-700 underline"
              >
                レシートを撮影して登録
              </Link>
            </div>
          ) : (
            <ExpenseCategoryPieChart data={pl.expenseByCategory} />
          )}
        </section>
      </div>

      {/* 損益トレンド */}
      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-stone-800">売上・経費・利益の推移（直近6ヶ月）</h2>
        <p className="mb-4 text-xs text-stone-400">
          経費には売上原価を含む。緑線が営業利益（マネーフォワードの損益推移相当）
        </p>
        <ProfitLossComboChart data={plChartData} />
      </section>

      {/* 売上分析 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">売上推移（日別・直近60日）</h2>
          <SalesLineChart data={data.daily} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">時間帯別売上</h2>
          <HourlyBarChart data={data.hourly.filter((h) => h.sales > 0)} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">曜日別売上</h2>
          <WeekdayBarChart data={data.weekday.map((w) => ({ label: w.label, sales: w.sales }))} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">イートイン / テイクアウト</h2>
          <EatInPieChart dineIn={data.eatInSplit.dineIn} takeout={data.eatInSplit.takeout} />
          <p className="mt-2 text-center text-xs text-stone-500">
            イートイン {data.eatInSplit.dineInRatio}% / テイクアウト {data.eatInSplit.takeoutRatio}%
          </p>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">支払い方法別</h2>
          <PaymentPieChart data={paymentData} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">商品別 TOP10</h2>
          <ProductBarChart data={data.products.map((p) => ({ name: p.name, sales: p.sales }))} />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">最近の経費</h2>
            <Link href="/admin/expenses" className="text-sm text-amber-700 hover:underline">
              すべて見る →
            </Link>
          </div>
          {data.recentExpenses.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-400">
              経費を登録するとここに表示されます
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {data.recentExpenses.map((e) => (
                <div key={e.id} className="flex justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-stone-800">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                    </p>
                    <p className="text-xs text-stone-400">
                      {e.expenseDate.toISOString().slice(0, 10)}
                      {e.description && ` · ${e.description}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-red-700">
                    {formatYen(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 前月比較サマリー */}
      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-stone-800">
          前月比較（{prevPl.label} → {pl.label}）
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "売上", cur: pl.revenue, prev: prevPl.revenue, change: cmp.revenueMoM },
            { label: "経費", cur: pl.expenses, prev: prevPl.expenses, change: cmp.expenseMoM },
            { label: "営業利益", cur: pl.operatingProfit, prev: prevPl.operatingProfit, change: cmp.profitMoM },
          ].map((row) => (
            <div key={row.label} className="rounded-xl bg-stone-50 p-4">
              <p className="text-sm text-stone-500">{row.label}</p>
              <p className="mt-1 text-xl font-bold">{formatYen(row.cur)}</p>
              <p className="mt-1 text-xs text-stone-400">前月 {formatYen(row.prev)}</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  row.change == null ? "text-stone-400" : row.change >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatPercent(row.change)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
