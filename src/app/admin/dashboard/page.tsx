import Link from "next/link";
import { getDashboardData } from "@/domain/analytics/analytics-service";
import { HourlyBarChart, PaymentPieChart, ProductBarChart, SalesLineChart } from "@/components/charts/sales-charts";
import { EmptyState, KpiCard, PageHeader, StatTable } from "@/components/admin/ui";
import { formatPercent, formatYen, PAYMENT_LABELS } from "@/lib/format";
import type { WeatherSnapshot } from "@/domain/weather/weather-service";

function formatWeather(w?: WeatherSnapshot) {
  if (!w) return "—";
  const temp =
    w.tempMax != null && w.tempMin != null
      ? `${Math.round(w.tempMin)}〜${Math.round(w.tempMax)}℃`
      : "";
  const rain = w.precipitation > 0 ? ` / ${w.precipitation}mm` : "";
  return `${w.label}${temp ? ` ${temp}` : ""}${rain}`;
}

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData({ businessDaysOnly: true });
  } catch {
    return (
      <>
        <PageHeader title="売上ダッシュボード" description="スマレジデータの分析" />
        <EmptyState message="データがありません。CSVをインポートしてください。" />
      </>
    );
  }

  const { summary, daily, hourly, products, weather } = data;

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

  const yoyTableRows = [...daily].reverse().slice(0, 14).map((d) => {
    const w = weather[d.date] as WeatherSnapshot | undefined;
    const wYoy = weather[d.yoyDate] as WeatherSnapshot | undefined;
    return [
      `${d.date.slice(5)} (${d.dayOfWeek})`,
      formatYen(d.sales),
      d.yoyDate.slice(5),
      d.yoySales != null ? formatYen(d.yoySales) : "—",
      d.vsYoYSameWeekday != null ? formatPercent(d.vsYoYSameWeekday) : "—",
      formatWeather(w),
      formatWeather(wYoy),
    ];
  });

  return (
    <>
      <PageHeader
        title="売上ダッシュボード"
        description={`${summary.store.name} / ${summary.store.location} / 営業日のみ / ${summary.store.openTime}–${summary.store.closeTime}`}
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
          change={summary.month.vsPrevYearSameMonth}
          sub={`前年同月 ${formatYen(summary.month.prevYearSales)}`}
        />
        {summary.today && (
          <KpiCard
            title={`最新営業日 (${summary.today.dayOfWeek})`}
            value={formatYen(summary.today.sales)}
            change={summary.today.vsYoYSameWeekday}
            sub={
              summary.today.yoySales != null
                ? `前年同曜日 ${summary.today.yoyDate?.slice(5)} → ${formatYen(summary.today.yoySales)}`
                : "前年同曜日データなし"
            }
          />
        )}
      </div>

      {summary.today && (
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-stone-800">
            天候（{summary.store.location}）
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-stone-50 p-4">
              <p className="text-xs font-medium text-stone-500">
                当日 {summary.today.date}（{summary.today.dayOfWeek}）
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-900">
                {formatWeather(weather[summary.today.date] as WeatherSnapshot | undefined)}
              </p>
            </div>
            {summary.today.yoyDate && (
              <div className="rounded-xl bg-stone-50 p-4">
                <p className="text-xs font-medium text-stone-500">
                  前年同曜日 {summary.today.yoyDate}
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {formatWeather(weather[summary.today.yoyDate] as WeatherSnapshot | undefined)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">日別 前年同曜日比較</h2>
        <StatTable
          headers={["日付", "売上", "前年日", "前年売上", "前年比", "天候", "前年年天候"]}
          rows={yoyTableRows}
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">売上推移（日別）</h2>
          <SalesLineChart data={daily} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-stone-800">時間帯別売上</h2>
          <HourlyBarChart data={hourly} />
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
