/**
 * ダッシュボードの売上整合性チェック。
 * 取引があるのにダッシュボードが空になるようなミスを検出する。
 */
import { getAnalyticsSummary } from "../src/domain/analytics/analytics-service";
import { getDashboardBundle } from "../src/domain/analytics/pl-analytics-service";
import { getDefaultStore, prisma } from "../src/lib/prisma";

async function main() {
  const store = await getDefaultStore();
  const [txCount, dailySum] = await Promise.all([
    prisma.salesTransaction.count({ where: { storeId: store.id } }),
    prisma.salesDailySummary.aggregate({
      where: { storeId: store.id },
      _sum: { netSales: true },
    }),
  ]);

  const summary = await getAnalyticsSummary({ businessDaysOnly: true });
  const bundle = await getDashboardBundle(store.id);

  const errors: string[] = [];

  if (txCount > 0 && summary.totals.sales === 0) {
    errors.push("取引はあるが summary.totals.sales が 0（集計不整合）");
  }

  const expectedMin = (dailySum._sum.netSales ?? 0) * 0.95;
  if ((dailySum._sum.netSales ?? 0) > 0 && summary.totals.sales < expectedMin) {
    errors.push(
      `summary.totals.sales (${summary.totals.sales}) が日次合計 (${dailySum._sum.netSales}) と大きく乖離`,
    );
  }

  if (summary.totals.sales > 0 && bundle.daily.length === 0) {
    errors.push("累計売上があるのに日別チャートデータが空");
  }

  if (bundle.plTrend.every((m) => m.revenue === 0) && txCount > 0) {
    errors.push("損益トレンドがすべて 0");
  }

  if (bundle.displayMonth.revenue === 0 && bundle.prevMonth.revenue > 0 && !bundle.displayMonthIsFallback) {
    errors.push("今月売上 0 だが前月あり — displayMonth フォールバックが効いていない可能性");
  }

  console.log("\n=== ダッシュボード整合性チェック ===\n");
  console.log(`取引件数: ${txCount}`);
  console.log(`累計売上: ¥${summary.totals.sales.toLocaleString()}`);
  console.log(`表示月: ${bundle.displayMonth.label} ¥${bundle.displayMonth.revenue.toLocaleString()}`);
  console.log(`日別データ: ${bundle.daily.length} 日分`);
  console.log(`損益トレンド: ${bundle.plTrend.map((m) => `${m.label}=${m.revenue}`).join(", ")}`);

  if (errors.length > 0) {
    console.log("\n✗ 問題:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }

  console.log("\n✓ ダッシュボード売上データ OK\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
