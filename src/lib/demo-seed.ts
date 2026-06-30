import {
  DataSource,
  EatInType,
  PaymentMethodType,
  ProductStatus,
  TransactionType,
} from "@prisma/client";
import { aggregateSales } from "@/domain/import/import-service";
import {
  categorySortOrder,
  WAITER_CATEGORY_ORDER,
  type WaiterCategoryName,
} from "@/lib/smaregi-categories";
import { getBusinessDate, getDayOfWeekJST } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

type DemoProduct = {
  category: WaiterCategoryName;
  name: string;
  priceDineIn: number;
  priceTakeout?: number;
  deptId: string;
  sendToKitchen?: boolean;
  sortOrder?: number;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  { category: "あんみつ", name: "宇治あんみつ", priceDineIn: 880, deptId: "1", sortOrder: 1 },
  { category: "あんみつ", name: "クリームあんみつ", priceDineIn: 980, deptId: "1", sortOrder: 2 },
  { category: "あんみつ", name: "黒蜜きなこあんみつ", priceDineIn: 880, deptId: "1", sortOrder: 3 },
  { category: "ソフトクリーム", name: "ソフトクリーム", priceDineIn: 450, deptId: "4", sortOrder: 1 },
  { category: "ソフトクリーム", name: "-ソフトクリーム増し", priceDineIn: 150, deptId: "4", sendToKitchen: false, sortOrder: 2 },
  { category: "ドリンク", name: "ブレンドコーヒー", priceDineIn: 550, deptId: "2", sendToKitchen: false, sortOrder: 1 },
  { category: "ドリンク", name: "紅茶", priceDineIn: 500, deptId: "2", sendToKitchen: false, sortOrder: 2 },
  { category: "ドリンク", name: "オレンジジュース", priceDineIn: 600, deptId: "2", sendToKitchen: false, sortOrder: 3 },
  { category: "ドリンク", name: "コーラフロート", priceDineIn: 650, deptId: "2", sendToKitchen: false, sortOrder: 4 },
  { category: "氷", name: "かき氷（宇治）", priceDineIn: 750, deptId: "6", sortOrder: 1 },
  { category: "氷", name: "コーヒーゼリー", priceDineIn: 680, deptId: "6", sortOrder: 2 },
  { category: "氷", name: "-ソフトクリーム", priceDineIn: 150, deptId: "6", sendToKitchen: false, sortOrder: 3 },
  { category: "シロップ", name: "-黒蜜", priceDineIn: 100, deptId: "7", sendToKitchen: false, sortOrder: 1 },
  { category: "シロップ", name: "-みつ", priceDineIn: 100, deptId: "7", sendToKitchen: false, sortOrder: 2 },
  { category: "軽食", name: "ナポリタン", priceDineIn: 980, deptId: "8", sortOrder: 1 },
  { category: "軽食", name: "オムライス", priceDineIn: 1200, deptId: "8", sortOrder: 2 },
  { category: "軽食", name: "トースト", priceDineIn: 480, deptId: "8", sortOrder: 3 },
];

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

/** Preview fallback when Smaregi CSV is not available. */
export async function ensureDemoData(storeId: string) {
  const productCount = await prisma.product.count({ where: { storeId } });
  if (productCount > 0) {
    await seedDemoSales(storeId);
    return;
  }

  const categoryIds = new Map<string, string>();
  for (const name of WAITER_CATEGORY_ORDER) {
    const cat = await prisma.productCategory.upsert({
      where: { storeId_name: { storeId, name } },
      create: { storeId, name, sortOrder: categorySortOrder(name) },
      update: { sortOrder: categorySortOrder(name), isActive: true },
    });
    categoryIds.set(name, cat.id);
  }

  for (const item of DEMO_PRODUCTS) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) continue;

    const product = await prisma.product.create({
      data: {
        storeId,
        categoryId,
        name: item.name,
        priceDineIn: item.priceDineIn,
        priceTakeout: item.priceTakeout ?? item.priceDineIn,
        smaregiDeptId: item.deptId,
        smaregiDeptName: item.category,
        sendToKitchen: item.sendToKitchen ?? true,
        sortOrder: item.sortOrder ?? 0,
        status: ProductStatus.ACTIVE,
        dataSource: DataSource.OWN_POS,
      },
    });

    await prisma.externalProductMapping.create({
      data: {
        productId: product.id,
        externalSource: DataSource.OWN_POS,
        externalProductId: `demo-${product.id}`,
        externalProductName: item.name,
      },
    });
  }

  await seedDemoSales(storeId);
}

async function seedDemoSales(storeId: string) {
  const existing = await prisma.salesTransaction.count({
    where: { storeId, externalId: { startsWith: "demo-" } },
  });
  if (existing > 0) return;

  const products = await prisma.product.findMany({
    where: { storeId, priceDineIn: { gt: 350 } },
    include: { category: true },
  });
  if (products.length === 0) return;

  const methods = [PaymentMethodType.CASH, PaymentMethodType.CREDIT_CARD, PaymentMethodType.QR];
  const today = getBusinessDate(new Date());

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const businessDate = new Date(today);
    businessDate.setUTCDate(businessDate.getUTCDate() - dayOffset);
    if (getDayOfWeekJST(businessDate) === 3) continue;

    const ordersPerDay = 35 + (dayOffset % 7) * 5;
    for (let i = 0; i < ordersPerDay; i++) {
      const product = products[(dayOffset + i) % products.length]!;
      const qty = 1 + (i % 3);
      const amount = product.priceDineIn * qty;
      const hour = 11 + (i % 7);
      const transactionAt = new Date(businessDate);
      transactionAt.setUTCHours(hour - 9, (i * 7) % 60, 0, 0);

      const externalId = `demo-${businessDate.toISOString().slice(0, 10)}-${i}`;
      const tx = await prisma.salesTransaction.create({
        data: {
          storeId,
          externalId,
          dataSource: DataSource.SMAREGI,
          transactionType: TransactionType.SALE,
          transactionAt,
          businessDate,
          subtotalAmount: amount,
          totalAmount: amount,
          tax10Amount: amount,
          consumptionTax10: Math.round((amount * 10) / 110),
          customerCount: 1 + (i % 4),
          eatInType: i % 5 === 0 ? EatInType.TAKEOUT : EatInType.DINE_IN,
          tableNumber: (i % 9) + 1,
        },
      });

      await prisma.salesTransactionItem.create({
        data: {
          salesTransactionId: tx.id,
          productId: product.id,
          productName: product.name,
          categoryName: product.category?.name ?? null,
          unitPrice: product.priceDineIn,
          quantity: qty,
          subtotalAmount: amount,
          totalAmount: amount,
        },
      });

      await prisma.salesTransactionPayment.create({
        data: {
          salesTransactionId: tx.id,
          method: methods[i % methods.length]!,
          amount,
        },
      });
    }
  }

  await aggregateSales(storeId, DataSource.SMAREGI);
}
