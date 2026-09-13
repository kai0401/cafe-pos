import Link from "next/link";
import { ProductTable } from "@/components/admin/product-table";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      include: { category: true, externalMapping: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const soldOut = products.filter((p) => p.status === "SOLD_OUT").length;

  return (
    <>
      <PageHeader
        title="商品管理"
        description={`名前・値段・トッピング・表示先（ウェイター / QR）を設定できます${
          soldOut > 0 ? ` · 売切 ${soldOut}件` : ""
        }`}
      >
        <Link href="/admin/products/photos" className="admin-btn admin-btn--primary">
          写真を登録
        </Link>
      </PageHeader>
      {categories.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">
          カテゴリがありません。先に商品CSVをインポートしてください。
        </p>
      ) : (
        <ProductTable products={products} categories={categories} />
      )}
    </>
  );
}
