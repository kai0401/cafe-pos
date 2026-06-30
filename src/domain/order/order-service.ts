import {
  DataSource,
  KitchenTicketStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethodType,
  ProductStatus,
  TableStatus,
  TransactionType,
} from "@prisma/client";
import { aggregateSales } from "@/domain/import/import-service";
import { getBusinessDate } from "@/lib/datetime";
import { WAITER_CATEGORY_ORDER } from "@/lib/smaregi-categories";
import { generateOrderNumber } from "@/lib/waiter-setup";
import { prisma } from "@/lib/prisma";

export async function getTablesWithOrders(storeId: string) {
  const tables = await prisma.table.findMany({
    where: { storeId },
    orderBy: [{ eatInType: "asc" }, { sortOrder: "asc" }, { number: "asc" }],
    include: {
      orders: {
        where: {
          status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
        },
        include: { items: { where: { status: { not: OrderItemStatus.CANCELLED } } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return tables.map((t) => {
    const order = t.orders[0];
    const pendingCount =
      order?.items.filter((i) => i.status === OrderItemStatus.PENDING).reduce((s, i) => s + i.quantity, 0) ?? 0;
    const totalCount = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    return {
      id: t.id,
      name: t.name,
      number: t.number,
      eatInType: t.eatInType,
      status: t.status,
      orderId: order?.id ?? null,
      pendingCount,
      itemCount: totalCount,
      customerCount: order?.customerCount ?? 0,
    };
  });
}

export async function getCategories(storeId: string, eatInType: "DINE_IN" | "TAKEOUT") {
  const categories = await prisma.productCategory.findMany({
    where: { storeId, isActive: true, name: { in: [...WAITER_CATEGORY_ORDER] } },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
      },
    },
  });

  return categories.map((cat) => {
    const products = cat.products.filter((p) => {
      const price = eatInType === "TAKEOUT" && p.priceTakeout ? p.priceTakeout : p.priceDineIn;
      return price > 0;
    });
    const soldOutCount = products.filter((p) => p.status === ProductStatus.SOLD_OUT).length;
    return {
      id: cat.id,
      name: cat.name,
      productCount: products.length,
      soldOutCount,
      badge: soldOutCount > 0 ? `売切: ${soldOutCount}` : undefined,
    };
  });
}

const MODIFIER_CATEGORIES: Record<string, string[]> = {
  あんみつ: ["ソフトクリーム"],
  氷: ["ソフトクリーム", "シロップ"],
  軽食: ["ソフトクリーム"],
};

function isMainProduct(name: string, price: number): boolean {
  if (price < 0 || name.startsWith("-") || name.startsWith("－")) return false;
  if (price <= 350) return false;
  if (name.includes("テイクアウト")) return false;
  return true;
}

function isModifierProduct(name: string, price: number): boolean {
  if (price < 0 || name.startsWith("-") || name.startsWith("－")) return true;
  if (price <= 350 && !name.includes("テイクアウト")) return true;
  return false;
}

function mapProduct(
  p: { id: string; name: string; priceDineIn: number; priceTakeout: number | null; status: ProductStatus },
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const price = eatInType === "TAKEOUT" && p.priceTakeout ? p.priceTakeout : p.priceDineIn;
  return {
    id: p.id,
    name: p.name,
    price,
    soldOut: p.status === ProductStatus.SOLD_OUT,
    status: p.status,
  };
}

export async function getCategoryProducts(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const products = await prisma.product.findMany({
    where: { storeId, categoryId, status: { not: ProductStatus.HIDDEN } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return products
    .map((p) => mapProduct(p, eatInType))
    .filter((p) => isMainProduct(p.name, p.price));
}

export async function getProductModifierGroups(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const category = await prisma.productCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const categoryNames = [category.name, ...(MODIFIER_CATEGORIES[category.name] ?? [])];

  const categories = await prisma.productCategory.findMany({
    where: { storeId, name: { in: categoryNames } },
    include: {
      products: { where: { status: { not: ProductStatus.HIDDEN } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });

  return categories
    .map((cat) => ({
      name: cat.name,
      items: cat.products
        .map((p) => mapProduct(p, eatInType))
        .filter((p) => isModifierProduct(p.name, p.price)),
    }))
    .filter((g) => g.items.length > 0);
}

export async function getTableOrder(tableId: string) {
  return prisma.order.findFirst({
    where: {
      tableId,
      status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
    },
    include: {
      items: {
        where: { status: { not: OrderItemStatus.CANCELLED } },
        orderBy: { createdAt: "asc" },
      },
      table: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function openTableOrder(
  tableId: string,
  storeId: string,
  customerCount: number,
) {
  const existing = await getTableOrder(tableId);
  if (existing) {
    if (existing.customerCount !== customerCount) {
      await prisma.order.update({
        where: { id: existing.id },
        data: { customerCount },
      });
    }
    return getTableOrder(tableId);
  }

  const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
  await prisma.order.create({
    data: {
      storeId,
      tableId,
      orderNumber: await generateOrderNumber(storeId),
      eatInType: table.eatInType,
      customerCount,
      status: OrderStatus.OPEN,
    },
  });
  await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.OCCUPIED } });
  return getTableOrder(tableId);
}

export async function addOrderItems(
  tableId: string,
  storeId: string,
  items: { productId: string; quantity: number; note?: string }[],
) {
  let order = await getTableOrder(tableId);
  if (!order) {
    order = await openTableOrder(tableId, storeId, 1);
  }
  if (!order) throw new Error("注文を開始できません");

  const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });

  for (const item of items) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
    if (product.status === ProductStatus.SOLD_OUT) {
      throw new Error(`${product.name}は売り切れです`);
    }

    const price =
      table.eatInType === "TAKEOUT" && product.priceTakeout
        ? product.priceTakeout
        : product.priceDineIn;

    const note = item.note?.trim() || null;
    const existing = order.items.find(
      (i) =>
        i.productId === item.productId &&
        i.status === OrderItemStatus.PENDING &&
        (i.note ?? null) === note,
    );

    if (existing) {
      await prisma.orderItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          unitPrice: price,
          quantity: item.quantity,
          note,
          status: OrderItemStatus.PENDING,
        },
      });
    }
  }

  return getTableOrder(tableId);
}

export async function updatePendingItemQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) {
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: OrderItemStatus.CANCELLED },
    });
    return;
  }
  await prisma.orderItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function sendOrderToKitchen(orderId: string) {
  const pendingItems = await prisma.orderItem.findMany({
    where: { orderId, status: OrderItemStatus.PENDING },
    include: { product: true },
  });

  if (pendingItems.length === 0) {
    throw new Error("送信する注文がありません");
  }

  for (const item of pendingItems) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { status: OrderItemStatus.SENT },
    });

    if (item.product.sendToKitchen) {
      const existing = await prisma.kitchenTicket.findUnique({ where: { orderItemId: item.id } });
      if (!existing) {
        await prisma.kitchenTicket.create({
          data: { orderItemId: item.id, status: KitchenTicketStatus.NEW },
        });
      }
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SENT_TO_KITCHEN },
  });

  return getTableOrder(
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).tableId,
  );
}

export async function cancelPendingOrder(orderId: string) {
  await prisma.orderItem.updateMany({
    where: { orderId, status: OrderItemStatus.PENDING },
    data: { status: OrderItemStatus.CANCELLED },
  });

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { where: { status: { not: OrderItemStatus.CANCELLED } } } },
  });

  if (order.items.length === 0) {
    await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
    await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.EMPTY } });
  }

  return getTableOrder(order.tableId);
}

export async function cancelTableTransaction(orderId: string) {
  await prisma.orderItem.updateMany({
    where: { orderId, status: { not: OrderItemStatus.CANCELLED } },
    data: { status: OrderItemStatus.CANCELLED },
  });

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
  await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.EMPTY } });

  return null;
}

export async function getKitchenTickets() {
  return prisma.kitchenTicket.findMany({
    where: { status: { in: [KitchenTicketStatus.NEW, KitchenTicketStatus.COOKING, KitchenTicketStatus.DONE] } },
    include: {
      orderItem: {
        include: { order: { include: { table: true } } },
      },
    },
    orderBy: { queuedAt: "asc" },
  });
}

export async function updateKitchenTicketStatus(ticketId: string, status: KitchenTicketStatus) {
  const data: { status: KitchenTicketStatus; doneAt?: Date } = { status };
  if (status === KitchenTicketStatus.DONE || status === KitchenTicketStatus.SERVED) {
    data.doneAt = new Date();
  }

  const ticket = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data,
    include: { orderItem: true },
  });

  if (status === KitchenTicketStatus.DONE) {
    await prisma.orderItem.update({
      where: { id: ticket.orderItemId },
      data: { status: OrderItemStatus.DONE },
    });
  }
  if (status === KitchenTicketStatus.SERVED) {
    await prisma.orderItem.update({
      where: { id: ticket.orderItemId },
      data: { status: OrderItemStatus.SERVED },
    });
  }

  await syncOrderStatusFromItems(ticket.orderItem.orderId);

  return ticket;
}

async function syncOrderStatusFromItems(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { status: { not: OrderItemStatus.CANCELLED } } } },
  });
  if (!order || order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) return;

  if (order.items.length === 0) return;

  const allServed = order.items.every(
    (item) => item.status === OrderItemStatus.SERVED || item.status === OrderItemStatus.DONE,
  );
  const hasSent = order.items.some((item) => item.status !== OrderItemStatus.PENDING);

  if (allServed && hasSent) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.READY },
    });
    return;
  }

  if (hasSent && order.status === OrderStatus.OPEN) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SENT_TO_KITCHEN },
    });
  }
}

export async function completeOrderCheckout(orderId: string, storeId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        where: { status: { not: OrderItemStatus.CANCELLED } },
        include: { product: true },
      },
      table: true,
    },
  });

  if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
    throw new Error("この取引はすでに完了しています");
  }

  if (order.items.length === 0) {
    throw new Error("注文がありません");
  }

  const pending = order.items.filter((item) => item.status === OrderItemStatus.PENDING);
  if (pending.length > 0) {
    throw new Error("未送信の注文があります。先に注文を送信してください");
  }

  const totalAmount = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemIds = order.items.map((item) => item.id);

  await prisma.orderItem.updateMany({
    where: { id: { in: itemIds } },
    data: { status: OrderItemStatus.SERVED },
  });

  await prisma.kitchenTicket.updateMany({
    where: {
      orderItemId: { in: itemIds },
      status: { not: KitchenTicketStatus.SERVED },
    },
    data: { status: KitchenTicketStatus.SERVED, doneAt: new Date() },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.PAID },
  });

  await prisma.table.update({
    where: { id: order.tableId },
    data: { status: TableStatus.EMPTY },
  });

  const businessDate = getBusinessDate(new Date());
  const tx = await prisma.salesTransaction.create({
    data: {
      storeId,
      externalId: `pos-${order.orderNumber}`,
      dataSource: DataSource.OWN_POS,
      transactionType: TransactionType.SALE,
      transactionAt: new Date(),
      businessDate,
      subtotalAmount: totalAmount,
      totalAmount: totalAmount,
      tax10Amount: totalAmount,
      consumptionTax10: Math.round((totalAmount * 10) / 110),
      customerCount: order.customerCount,
      eatInType: order.eatInType,
      tableNumber: order.table.number,
    },
  });

  for (const item of order.items) {
    await prisma.salesTransactionItem.create({
      data: {
        salesTransactionId: tx.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotalAmount: item.unitPrice * item.quantity,
        totalAmount: item.unitPrice * item.quantity,
      },
    });
  }

  await prisma.salesTransactionPayment.create({
    data: {
      salesTransactionId: tx.id,
      method: PaymentMethodType.CASH,
      amount: totalAmount,
    },
  });

  await aggregateSales(storeId, DataSource.OWN_POS);

  return { totalAmount, orderNumber: order.orderNumber };
}
