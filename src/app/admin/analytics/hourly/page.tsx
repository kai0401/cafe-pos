import { getHourlySales, getWeekdaySales } from "@/domain/analytics/analytics-service";
import { HourlyBarChart, WeekdayBarChart } from "@/components/charts/sales-charts";
import { EmptyState, PageHeader } from "@/components/admin/ui";

export default async function HourlySalesPage() {
  let hourly;
  let weekday;
  try {
    [hourly, weekday] = await Promise.all([
      getHourlySales({ businessHoursOnly: false, businessDaysOnly: false }),
      getWeekdaySales({ businessDaysOnly: false }),
    ]);
  } catch {
    return (
      <>
        <PageHeader title="時間帯別売上" />
        <EmptyState message="データがありません" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="時間帯別・曜日別売上"
        description="全時間帯・全曜日表示（11–18時以外・木曜も含む）"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">時間帯別（1時間単位）</h2>
          <HourlyBarChart data={hourly.filter((h) => h.sales > 0)} />
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">曜日別</h2>
          <WeekdayBarChart data={weekday.map((d) => ({ label: d.label, sales: d.sales }))} />
        </section>
      </div>
    </>
  );
}
