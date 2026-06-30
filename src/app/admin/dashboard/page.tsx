import Link from "next/link";
import { getAnalyticsSummary, getDailySales, getHourlySales, getProductSales } from "@/domain/analytics/analytics-service";
import { HourlyBarChart, PaymentPieChart, ProductBarChart, SalesLineChart } from "@/components/charts/sales-charts";
import { EmptyState, KpiCard, PageHeader } from "@/components/admin/ui";
import { formatYen, PAYMENT_LABELS } from "@/lib/format";

export default async function DashboardPage() {
  let summary;
  let daily;
  let hourly;
  let products;

  try {
    [summary, daily, hourly, products] = await Promise.all([
      getAnalyticsSummary({ businessDaysOnly: true }),
      getDailySales({ businessDaysOnly: true }),
      getHourlySales({ businessHoursOnly: true, businessDaysOnly: true }),
      getProductSales({ businessDaysOnly: true }, 10),
    ]);
  } catch {
    return (
      <>
        <PageHeader title="売上ダッシュボード" description="スマレジデータの分析" />
        <EmptyState message="データがありません。CSVをインポートしてください。" />
      </>
    );
  }

  if (summary.totals.sales === 0) {
    return (
      <>
        <PageHeader title="売上ダッシュボード" description="スマレジデータの分析" />
        <EmptyState message="データがありません。CSVをインポートしてください。" />
      </>
    );
  }

  const paymentData = summary.payments.map((p) => ({
    label: PAYMENT_LABELS[p.method] ?? p.method,
    amount: p.amount,
  }));

  return (
    <>
      <PageHeader
        title="売上ダッシュボード"
        description={`${summary.store.name} / 営業日のみ表示 / ${summary.store.openTime}–${summary.store.closeTime}`}
      >
        <Link
          href="/admin/imports"
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          CSVインポート
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="累計売上"
          value={formatYen(summary.totals.sales)}
          sub={`${summary.totals.orders.toLocaleString()}件 / ${summary.totals.customers.toLocaleString()}人`}
        />
        <KpiCard title="客単価" value={formatYen(summary.totals.avgSpend)} />
        <KpiCard
          title="今月売上"
          value={formatYen(summary.month.sales)}
          change={summary.month.vsPrevMonth}
        />
        {summary.today && (
          <KpiCard
            title="最新営業日"
            value={formatYen(summary.today.sales)}
            change={summary.today.vsYesterday}
            sub={`${summary.today.customers}人 / 前日比`}
          />
        )}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">売上推移（日別）</h2>
          <SalesLineChart data={daily.slice(-60)} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">時間帯別売上</h2>
          <HourlyBarChart data={hourly.filter((h) => h.sales > 0)} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">商品別 TOP10</h2>
          <ProductBarChart data={products.map((p) => ({ name: p.name, sales: p.sales }))} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">支払い方法別</h2>
          <PaymentPieChart data={paymentData} />
        </section>
      </div>
    </>
  );
}
