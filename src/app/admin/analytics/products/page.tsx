import { getProductSales } from "@/domain/analytics/analytics-service";
import { ProductBarChart } from "@/components/charts/sales-charts";
import { EmptyState, PageHeader, StatTable } from "@/components/admin/ui";

export default async function ProductSalesPage() {
  let products;
  try {
    products = await getProductSales({ businessDaysOnly: false }, 50);
  } catch {
    return (
      <>
        <PageHeader title="商品別売上" />
        <EmptyState message="データがありません" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="商品別売上" description="販売数・売上・構成比" />
      <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <ProductBarChart data={products.slice(0, 15).map((p) => ({ name: p.name, sales: p.sales }))} />
      </section>
      <StatTable
        headers={["順位", "商品名", "カテゴリ", "数量", "売上", "構成比"]}
        rows={products.map((p) => [
          p.rank,
          p.name,
          p.category ?? "—",
          p.qty,
          p.sales,
          `${p.share}%`,
        ])}
      />
    </>
  );
}
