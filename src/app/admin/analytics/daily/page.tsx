import { getDailySales } from "@/domain/analytics/analytics-service";
import { SalesLineChart } from "@/components/charts/sales-charts";
import { EmptyState, PageHeader, StatTable } from "@/components/admin/ui";

export default async function DailySalesPage() {
  let daily: Awaited<ReturnType<typeof getDailySales>> = [];
  try {
    daily = await getDailySales({ businessDaysOnly: false });
  } catch {
    return (
      <>
        <PageHeader title="日別売上" />
        <EmptyState message="データがありません" />
      </>
    );
  }

  if (daily.length === 0) {
    return (
      <>
        <PageHeader title="日別売上" />
        <EmptyState message="データがありません" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="日別売上"
        description="全日表示（木曜・営業時間外の取引も含む）"
      />
      <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <SalesLineChart data={daily} />
      </section>
      <StatTable
        headers={["日付", "曜日", "売上", "客数", "注文数", "客単価"]}
        rows={daily
          .slice()
          .reverse()
          .slice(0, 60)
          .map((d: (typeof daily)[number]) => [d.date, d.dayOfWeek, d.sales, d.customers, d.orders, d.avgSpend])}
      />
    </>
  );
}
