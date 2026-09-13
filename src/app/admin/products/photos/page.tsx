import Link from "next/link";
import { ProductPhotoForm } from "@/components/admin/product-photo-form";
import { PageHeader } from "@/components/admin/ui";
import { isMainProduct } from "@/lib/menu-modifiers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductPhotosPage() {
  const products = await prisma.product.findMany({
    where: { status: { not: "HIDDEN" } },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const main = products
    .filter((p) => isMainProduct(p.name, p.priceDineIn))
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceDineIn: p.priceDineIn,
      imagePath: p.imagePath,
      updatedAt: p.updatedAt.toISOString(),
      categoryName: p.category?.name ?? "その他",
    }));

  return (
    <>
      <PageHeader
        title="商品写真"
        description="QRオーダーのメニューに表示する写真です。JPEG / PNG / HEIC を選べます。"
      >
        <Link href="/admin/products" className="admin-btn admin-btn--ghost">
          商品一覧へ
        </Link>
      </PageHeader>
      <ProductPhotoForm products={main} />
    </>
  );
}
