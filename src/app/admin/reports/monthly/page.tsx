import { getMonthlyReport } from "@/domain/analytics/analytics-service";
import { HourlyBarChart, PaymentPieChart, ProductBarChart, WeekdayBarChart } from "@/components/charts/sales-charts";
import { EmptyState, KpiCard, PageHeader } from "@/components/admin/ui";
import { formatPercent, formatYen } from "@/lib/format";

export default async function MonthlyReportPage() {
  let report;
  try {
    report = await getMonthlyReport({ businessDaysOnly: true });
  } catch {
    return (
      <>
        <PageHeader title="月次レポート" />
        <EmptyState message="データがありません" />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="MONTHLY" title="月次レポート" description={report.period} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="月間売上" value={formatYen(report.monthSales)} change={report.prevMonthRatio} />
        <KpiCard title="営業日数" value={`${report.businessDays}日`} />
        <KpiCard title="1日平均" value={formatYen(report.avgDailySales)} />
        <KpiCard
          title="客数 / 客単価"
          value={`${report.customers.toLocaleString()}人`}
          sub={formatYen(report.avgSpend)}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">商品 TOP20</h2>
          <ProductBarChart data={report.topProducts.slice(0, 10).map((p) => ({ name: p.name, sales: p.sales }))} />
        </section>
        <section className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">支払い方法</h2>
          <PaymentPieChart data={report.payments.map((p) => ({ label: p.label, amount: p.amount }))} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">曜日別傾向</h2>
          <WeekdayBarChart data={report.weekday.map((d) => ({ label: d.label, sales: d.sales }))} />
        </section>
        <section className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif mb-4 text-base">時間帯別傾向</h2>
          <HourlyBarChart data={report.hourly.filter((h) => h.sales > 0)} />
        </section>
      </div>

      <section className="mt-6 admin-card p-6 print:block">
        <h2 className="admin-title admin-brand-serif text-base">印刷用サマリー</h2>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-[var(--admin-ink)]">
{`${report.store} 月次レポート ${report.period}
月間売上: ${formatYen(report.monthSales)} (${formatPercent(report.prevMonthRatio)} 前月比)
営業日数: ${report.businessDays}日 / 1日平均: ${formatYen(report.avgDailySales)}
客数: ${report.customers} / 客単価: ${formatYen(report.avgSpend)}

商品TOP5:
${report.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} ¥${p.sales.toLocaleString()}`).join("\n")}`}
        </pre>
      </section>
    </>
  );
}
