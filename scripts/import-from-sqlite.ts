/**
 * Macの dev.db (SQLite) から PostgreSQL にデータをコピー
 * npx tsx scripts/import-from-sqlite.ts [path/to/dev.db]
 */
import { PrismaClient } from "@prisma/client";

const sourcePath = process.argv[2] ?? "prisma/dev.db";
const source = new PrismaClient({
  datasources: { db: { url: `file:${sourcePath}` } },
});
const target = new PrismaClient();

async function main() {
  const store = await source.store.findFirst();
  if (!store) throw new Error("SQLite DB に店舗データがありません");

  const [productCount, txCount] = await Promise.all([
    source.product.count({ where: { storeId: store.id } }),
    source.salesTransaction.count({ where: { storeId: store.id } }),
  ]);
  if (productCount === 0 && txCount === 0) {
    throw new Error("SQLite DB が空です");
  }

  console.log(`Source: products=${productCount}, transactions=${txCount}`);

  // デモデータを削除
  await target.salesTransaction.deleteMany({
    where: { externalId: { startsWith: "demo-" } },
  });
  await target.product.deleteMany({
    where: { dataSource: "OWN_POS" },
  });

  let targetStore = await target.store.findFirst();
  if (!targetStore) {
    targetStore = await target.store.create({
      data: {
        name: store.name,
        openTime: store.openTime,
        closeTime: store.closeTime,
        regularClosedDays: store.regularClosedDays,
      },
    });
  } else {
    await target.store.update({
      where: { id: targetStore.id },
      data: {
        name: store.name,
        openTime: store.openTime,
        closeTime: store.closeTime,
        regularClosedDays: store.regularClosedDays,
      },
    });
  }

  const categoryIdMap = new Map<string, string>();
  const categories = await source.productCategory.findMany({ where: { storeId: store.id } });
  for (const cat of categories) {
    const created = await target.productCategory.upsert({
      where: { storeId_name: { storeId: targetStore.id, name: cat.name } },
      create: {
        storeId: targetStore.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      },
      update: { sortOrder: cat.sortOrder, isActive: cat.isActive },
    });
    categoryIdMap.set(cat.id, created.id);
  }

  const productIdMap = new Map<string, string>();
  const products = await source.product.findMany({ where: { storeId: store.id } });
  for (const p of products) {
    const created = await target.product.create({
      data: {
        storeId: targetStore.id,
        categoryId: p.categoryId ? categoryIdMap.get(p.categoryId) ?? null : null,
        name: p.name,
        priceDineIn: p.priceDineIn,
        priceTakeout: p.priceTakeout,
        costAmount: p.costAmount,
        smaregiDeptId: p.smaregiDeptId,
        smaregiDeptName: p.smaregiDeptName,
        sendToKitchen: p.sendToKitchen,
        sortOrder: p.sortOrder,
        status: p.status,
        dataSource: p.dataSource,
      },
    });
    productIdMap.set(p.id, created.id);

    const mappings = await source.externalProductMapping.findMany({
      where: { productId: p.id },
    });
    for (const m of mappings) {
      await target.externalProductMapping.create({
        data: {
          productId: created.id,
          externalSource: m.externalSource,
          externalProductId: m.externalProductId,
          externalProductName: m.externalProductName,
        },
      });
    }
  }

  const transactions = await source.salesTransaction.findMany({
    where: { storeId: store.id },
    include: { items: true, payments: true },
  });

  for (const tx of transactions) {
    const created = await target.salesTransaction.create({
      data: {
        storeId: targetStore.id,
        externalId: tx.externalId,
        dataSource: tx.dataSource,
        transactionType: tx.transactionType,
        transactionAt: tx.transactionAt,
        businessDate: tx.businessDate,
        subtotalAmount: tx.subtotalAmount,
        totalAmount: tx.totalAmount,
        tax8Amount: tx.tax8Amount,
        tax10Amount: tx.tax10Amount,
        consumptionTax8: tx.consumptionTax8,
        consumptionTax10: tx.consumptionTax10,
        customerCount: tx.customerCount,
        eatInType: tx.eatInType,
        tableNumber: tx.tableNumber,
      },
    });

    for (const item of tx.items) {
      await target.salesTransactionItem.create({
        data: {
          salesTransactionId: created.id,
          productId: item.productId ? productIdMap.get(item.productId) ?? null : null,
          productName: item.productName,
          categoryName: item.categoryName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotalAmount: item.subtotalAmount,
          totalAmount: item.totalAmount,
          costAmount: item.costAmount,
        },
      });
    }

    for (const pay of tx.payments) {
      await target.salesTransactionPayment.create({
        data: {
          salesTransactionId: created.id,
          method: pay.method,
          amount: pay.amount,
        },
      });
    }
  }

  const { ensureWaiterSetup } = await import("../src/lib/waiter-setup");
  await ensureWaiterSetup();

  const [finalProducts, finalTxs] = await Promise.all([
    target.product.count(),
    target.salesTransaction.count(),
  ]);
  console.log(`Import complete: products=${finalProducts}, transactions=${finalTxs}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
