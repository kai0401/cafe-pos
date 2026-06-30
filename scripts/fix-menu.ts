import fs from "fs";
import { parseCsvBuffer } from "../src/domain/import/csv-parser";
import { getColumn } from "../src/domain/import/smaregi-mapper";
import { resolveCategoryName, categorySortOrder, WAITER_CATEGORY_ORDER } from "../src/lib/smaregi-categories";
import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { getDefaultStore, prisma } from "../src/lib/prisma";

async function main() {
  const productPath = process.argv[2];
  const store = await getDefaultStore();

  if (productPath) {
    const buffer = fs.readFileSync(productPath);
    const parsed = parseCsvBuffer(buffer);
    for (const row of parsed.rows) {
      const extId = getColumn(row, "商品ID");
      if (!extId) continue;
      const deptId = getColumn(row, "部門ID");
      const name = getColumn(row, "商品名");
      const categoryName = resolveCategoryName(deptId, name);

      let category = await prisma.productCategory.findUnique({
        where: { storeId_name: { storeId: store.id, name: categoryName } },
      });
      if (!category) {
        category = await prisma.productCategory.create({
          data: { storeId: store.id, name: categoryName, sortOrder: categorySortOrder(categoryName) },
        });
      }

      const mapping = await prisma.externalProductMapping.findUnique({
        where: { externalSource_externalProductId: { externalSource: "SMAREGI", externalProductId: extId } },
      });

      if (mapping) {
        await prisma.product.update({
          where: { id: mapping.productId },
          data: { categoryId: category.id, smaregiDeptId: deptId, name },
        });
      }
    }
    console.log("Fixed from CSV");
  }

  await ensureWaiterSetup();

  const cats = await prisma.productCategory.findMany({
    where: { storeId: store.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  console.log("\nCategories:");
  for (const c of cats) {
    console.log(`  ${c.name}: ${c._count.products}商品`);
  }
  console.log(`\nTables: ${await prisma.table.count()}`);
}

main().finally(() => prisma.$disconnect());
