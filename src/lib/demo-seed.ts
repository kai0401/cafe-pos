import { DataSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Remove placeholder menu items that were auto-generated for empty databases. */
export async function removeDemoMenu(storeId: string) {
  const demoProducts = await prisma.product.findMany({
    where: { storeId, dataSource: DataSource.OWN_POS },
    select: { id: true },
  });
  if (demoProducts.length === 0) return 0;

  const ids = demoProducts.map((p) => p.id);
  await prisma.externalProductMapping.deleteMany({ where: { productId: { in: ids } } });
  await prisma.salesTransactionItem.updateMany({
    where: { productId: { in: ids } },
    data: { productId: null },
  });
  await prisma.orderItem.deleteMany({ where: { productId: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}
