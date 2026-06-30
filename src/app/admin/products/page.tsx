import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, StatTable } from "@/components/admin/ui";
import { formatYen } from "@/lib/format";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { category: true, externalMapping: true },
    orderBy: { name: "asc" },
  });

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="商品管理" description="スマレジ商品マスターから取り込んだ商品一覧" />
        <EmptyState message="商品がありません。商品CSVをインポートしてください。" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="商品管理" description={`${products.length}件の商品`} />
      <StatTable
        headers={["商品名", "カテゴリ", "価格", "原価", "状態", "スマレジID"]}
        rows={products.map((p) => [
          p.name,
          p.category?.name ?? "—",
          p.priceDineIn,
          p.costAmount ?? "—",
          p.status,
          p.externalMapping[0]?.externalProductId ?? "—",
        ])}
      />
    </>
  );
}
