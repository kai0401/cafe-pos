import { ProductTable } from "@/components/admin/product-table";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { category: true, externalMapping: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="商品管理" description="スマレジ商品マスターから取り込んだ商品一覧" />
        <EmptyState message="商品がありません。商品CSVをインポートしてください。" />
      </>
    );
  }

  const soldOut = products.filter((p) => p.status === "SOLD_OUT").length;

  return (
    <>
      <PageHeader
        title="商品管理"
        description={`${products.length}件の商品${soldOut > 0 ? `（売切 ${soldOut}件）` : ""} · 状態ボタンで 販売中 → 売切 → 非表示 を切替`}
      />
      <ProductTable products={products} />
    </>
  );
}
