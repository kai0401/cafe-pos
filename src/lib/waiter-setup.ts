import { EatInType, OrderStatus, TableStatus } from "@prisma/client";
import { categorySortOrder, resolveCategoryName, WAITER_CATEGORY_ORDER } from "./smaregi-categories";
import { getDefaultStore, prisma } from "./prisma";

const TABLES = [
  ...Array.from({ length: 9 }, (_, i) => ({
    name: `T${i + 1}`,
    number: i + 1,
    eatInType: EatInType.DINE_IN,
    sortOrder: i + 1,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    name: `${i + 1}`,
    number: 100 + i + 1,
    eatInType: EatInType.TAKEOUT,
    sortOrder: i + 1,
  })),
];

async function resetStaleOpenOrders(storeId: string) {
  const emptyOrders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
      items: { none: {} },
    },
    select: { id: true, tableId: true },
  });
  if (emptyOrders.length === 0) return;

  await prisma.order.deleteMany({ where: { id: { in: emptyOrders.map((o) => o.id) } } });

  const tableIds = [...new Set(emptyOrders.map((o) => o.tableId))];
  for (const tableId of tableIds) {
    const active = await prisma.order.count({
      where: {
        tableId,
        status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
      },
    });
    if (active === 0) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: TableStatus.EMPTY },
      });
    }
  }
}

export async function ensureWaiterSetup() {
  const store = await getDefaultStore();

  await resetStaleOpenOrders(store.id);
  for (const t of TABLES) {
    await prisma.table.upsert({
      where: { storeId_name: { storeId: store.id, name: t.name } },
      create: {
        storeId: store.id,
        name: t.name,
        number: t.number,
        eatInType: t.eatInType,
        sortOrder: t.sortOrder,
        status: TableStatus.EMPTY,
      },
      update: { sortOrder: t.sortOrder },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const name of WAITER_CATEGORY_ORDER) {
    const cat = await prisma.productCategory.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      create: { storeId: store.id, name, sortOrder: categorySortOrder(name) },
      update: { sortOrder: categorySortOrder(name), isActive: true },
    });
    categoryIds.set(name, cat.id);
  }

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: { externalMapping: true },
  });

  for (const product of products) {
    const deptId = product.smaregiDeptId ?? inferDeptId(product.name, product.externalMapping[0]?.externalProductId);
    const categoryName = resolveCategoryName(deptId, product.name);
    const categoryId = categoryIds.get(categoryName);

    if (categoryId) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId,
          smaregiDeptId: deptId || product.smaregiDeptId,
        },
      });
    }
  }

  await prisma.productCategory.updateMany({
    where: {
      storeId: store.id,
      name: { notIn: [...WAITER_CATEGORY_ORDER] },
    },
    data: { isActive: false },
  });

  return store;
}

function inferDeptId(productName: string, extId?: string): string {
  const id = parseInt(extId ?? "0", 10);
  if (id >= 8000000) return "8000001";
  if (productName.includes("ナポリタン") || productName.includes("オムライス")) return "8";
  if (productName.includes("コーヒー") || productName.includes("ジュース") || productName.includes("コーラ") || productName.includes("ソーダ") || productName.includes("フロート")) return "2";
  if (productName.includes("氷") || productName.includes("かき氷")) return "6";
  if (productName.includes("練乳") || productName.includes("黒蜜") || productName.includes("シロップ")) return "7";
  if (productName.includes("ソフト") || productName.includes("アイス")) return "4";
  return "1";
}

export async function generateOrderNumber(storeId: string): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await prisma.order.count({
    where: { storeId, createdAt: { gte: start } },
  });
  const d = new Date();
  const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
