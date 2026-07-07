import {
  DataSource,
  KitchenTicketStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethodType,
  PaymentSessionStatus,
  ProductStatus,
  TableStatus,
  TransactionType,
} from "@prisma/client";
import { aggregateSales } from "@/domain/import/import-service";
import { getBusinessDate } from "@/lib/datetime";
import { PAYMENT_LABELS } from "@/lib/format";
import {
  buildDrawerKick,
  buildKitchenTicket,
  buildReceipt,
  sendToPrinter,
} from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { isModifierChildLine, countDisplayOrderItems, parseModifierBundle } from "@/lib/order-modifiers";
import {
  categoryHasModifiers,
  isCrossCategoryModifier,
  isMainProduct,
  isModifierProduct,
  isSameCategoryModifier,
  MODIFIER_GROUP_DEFS,
} from "@/lib/menu-modifiers";
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
      order?.items
        .filter((i) => i.status === OrderItemStatus.PENDING)
        .filter((i) => !isModifierChildLine(i.productId, i.note))
        .reduce((s, i) => s + i.quantity, 0) ?? 0;
    const totalCount = order ? countDisplayOrderItems(order.items) : 0;
    const totalAmount = order?.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    return {
      id: t.id,
      name: t.name,
      number: t.number,
      eatInType: t.eatInType,
      status: t.status,
      orderId: order?.id ?? null,
      orderChannel: order?.channel ?? null,
      pendingCount,
      itemCount: totalCount,
      customerCount: order?.customerCount ?? 0,
      totalAmount,
      openedAt: order?.createdAt.toISOString() ?? null,
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

function mapProduct(
  p: { id: string; name: string; priceDineIn: number; priceTakeout: number | null; status: ProductStatus },
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const price = eatInType === "TAKEOUT" && p.priceTakeout ? p.priceTakeout : p.priceDineIn;
  return {
    id: p.id,
    name: p.name,
    price,
    priceDineIn: p.priceDineIn,
    priceTakeout: p.priceTakeout,
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

/** サイドバー付きメニュー画面用: 全カテゴリ + 商品 + オプション有無を一括取得 */
export async function getFullMenu(storeId: string, eatInType: "DINE_IN" | "TAKEOUT") {
  const categories = await prisma.productCategory.findMany({
    where: { storeId, isActive: true, name: { in: [...WAITER_CATEGORY_ORDER] } },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  const categoryOrder: readonly string[] = WAITER_CATEGORY_ORDER;
  const sorted = [...categories].sort(
    (a, b) => categoryOrder.indexOf(a.name) - categoryOrder.indexOf(b.name),
  );

  return sorted
    .map((cat) => {
      const mapped = cat.products.map((p) => mapProduct(p, eatInType));
      const products = mapped.filter((p) => isMainProduct(p.name, p.price));
      const hasModifiers = categoryHasModifiers(cat.name, mapped);
      return { id: cat.id, name: cat.name, hasModifiers, products };
    })
    .filter((cat) => cat.products.length > 0);
}

export async function getProductModifierGroups(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const category = await prisma.productCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const defs = MODIFIER_GROUP_DEFS[category.name];
  if (!defs?.length) return [];

  const allSourceNames = [...new Set(defs.flatMap((d) => d.sourceCategories))];
  const categories = await prisma.productCategory.findMany({
    where: { storeId, name: { in: allSourceNames } },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const byName = new Map(categories.map((c) => [c.name, c]));

  const groups: { name: string; items: ReturnType<typeof mapProduct>[] }[] = [];

  for (const def of defs) {
    const items: ReturnType<typeof mapProduct>[] = [];
    const seen = new Set<string>();

    for (const sourceName of def.sourceCategories) {
      const source = byName.get(sourceName);
      if (!source) continue;

      const isCross = def.crossCategory ?? sourceName !== category.name;
      for (const product of source.products) {
        const mapped = mapProduct(product, eatInType);
        const isMod = isCross
          ? isCrossCategoryModifier(mapped.name, mapped.price)
          : isSameCategoryModifier(mapped.name, mapped.price);
        if (!isMod || seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        items.push(mapped);
      }
    }

    if (items.length > 0) {
      groups.push({ name: def.label, items });
    }
  }

  return groups;
}

export type ModifierMenuProduct = {
  id: string;
  name: string;
  price: number;
  priceDineIn: number;
  priceTakeout: number | null;
  soldOut: boolean;
  status: ProductStatus;
  categoryName: string;
};

/** ウェイター用: トッピング・オプション一覧（価格調整画面） */
export async function getModifierProductsMenu(
  storeId: string,
  eatInType: "DINE_IN" | "TAKEOUT" = "DINE_IN",
) {
  const categories = await prisma.productCategory.findMany({
    where: { storeId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  const byCategory = new Map<string, ModifierMenuProduct[]>();

  for (const cat of categories) {
    for (const product of cat.products) {
      const mapped = mapProduct(product, eatInType);
      if (!isModifierProduct(mapped.name, mapped.price)) continue;
      const row: ModifierMenuProduct = {
        id: product.id,
        name: product.name,
        price: mapped.price,
        priceDineIn: product.priceDineIn,
        priceTakeout: product.priceTakeout,
        soldOut: mapped.soldOut,
        status: product.status,
        categoryName: cat.name,
      };
      const list = byCategory.get(cat.name) ?? [];
      list.push(row);
      byCategory.set(cat.name, list);
    }
  }

  return [...byCategory.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([name, products]) => ({ id: name, name, products }));
}

export async function updateProductPricing(
  productId: string,
  patch: { priceDineIn?: number; priceTakeout?: number | null; status?: ProductStatus },
) {
  const data: {
    priceDineIn?: number;
    priceTakeout?: number | null;
    status?: ProductStatus;
  } = {};

  if (patch.priceDineIn !== undefined) {
    if (!Number.isInteger(patch.priceDineIn) || patch.priceDineIn < -10000 || patch.priceDineIn > 100000) {
      throw new Error("イートイン価格が不正です");
    }
    data.priceDineIn = patch.priceDineIn;
  }

  if (patch.priceTakeout !== undefined) {
    if (
      patch.priceTakeout !== null &&
      (!Number.isInteger(patch.priceTakeout) || patch.priceTakeout < -10000 || patch.priceTakeout > 100000)
    ) {
      throw new Error("テイクアウト価格が不正です");
    }
    data.priceTakeout = patch.priceTakeout;
  }

  if (patch.status !== undefined) {
    data.status = patch.status;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("更新する項目がありません");
  }

  return prisma.product.update({
    where: { id: productId },
    data,
    select: {
      id: true,
      name: true,
      status: true,
      priceDineIn: true,
      priceTakeout: true,
    },
  });
}

/** カテゴリにトッピングがあるか（UI用） */
export async function categoryHasModifierOptions(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const groups = await getProductModifierGroups(storeId, categoryId, eatInType);
  return groups.length > 0;
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
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const pendingMap = new Map<string, (typeof order.items)[number]>();
  for (const row of order.items) {
    if (row.status === OrderItemStatus.PENDING) {
      pendingMap.set(`${row.productId}:${row.note ?? ""}`, row);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error("商品が見つかりません");
      if (product.status === ProductStatus.SOLD_OUT) {
        throw new Error(`${product.name}は売り切れです`);
      }

      const price =
        table.eatInType === "TAKEOUT" && product.priceTakeout
          ? product.priceTakeout
          : product.priceDineIn;

      const note = item.note?.trim() || null;
      const key = `${item.productId}:${note ?? ""}`;
      const existing = pendingMap.get(key);

      if (existing) {
        const quantity = existing.quantity + item.quantity;
        await tx.orderItem.update({
          where: { id: existing.id },
          data: { quantity },
        });
        existing.quantity = quantity;
      } else {
        const created = await tx.orderItem.create({
          data: {
            orderId: order!.id,
            productId: product.id,
            productName: product.name,
            unitPrice: price,
            quantity: item.quantity,
            note,
            status: OrderItemStatus.PENDING,
          },
        });
        pendingMap.set(key, created);
      }
    }
  });

  return getTableOrder(tableId);
}

export async function addAndSendOrderItems(
  tableId: string,
  storeId: string,
  items: { productId: string; quantity: number; note?: string }[],
) {
  const order = await addOrderItems(tableId, storeId, items);
  if (!order?.id) throw new Error("注文を開始できません");
  return sendOrderToKitchen(order.id);
}

export async function updateOrderMeta(
  orderId: string,
  data: { staffName?: string | null; customerSegment?: string | null },
) {
  const order = await prisma.order.update({ where: { id: orderId }, data });
  return getTableOrder(order.tableId);
}

/** ウェイターが配膳完了をマーク（キッチン完了後） */
export async function markItemServed(itemId: string) {
  const item = await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: OrderItemStatus.SERVED },
  });
  await prisma.kitchenTicket.updateMany({
    where: { orderItemId: itemId },
    data: { status: KitchenTicketStatus.SERVED, doneAt: new Date() },
  });
  await syncModifierBundleSiblings(item, OrderItemStatus.SERVED);
  await syncOrderStatusFromItems(item.orderId);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: item.orderId } });
  return getTableOrder(order.tableId);
}

async function syncModifierBundleSiblings(
  item: { id: string; orderId: string; note: string | null; productId: string },
  status: OrderItemStatus,
) {
  if (!parseModifierBundle(item.note)) return;
  await prisma.orderItem.updateMany({
    where: {
      orderId: item.orderId,
      note: item.note,
      id: { not: item.id },
      status: { not: OrderItemStatus.CANCELLED },
    },
    data: { status },
  });
}

export async function updatePendingItemQuantity(itemId: string, quantity: number) {
  const existing = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new Error("注文が見つかりません");
  if (existing.status !== OrderItemStatus.PENDING) {
    throw new Error("送信済みの注文は変更できません");
  }

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

  const pendingIds = pendingItems.map((i) => i.id);
  const kitchenIds = pendingItems
    .filter(
      (i) =>
        i.product.sendToKitchen && !isModifierChildLine(i.productId, i.note),
    )
    .map((i) => i.id);
  const existingTickets = await prisma.kitchenTicket.findMany({
    where: { orderItemId: { in: kitchenIds } },
    select: { orderItemId: true },
  });
  const hasTicket = new Set(existingTickets.map((t) => t.orderItemId));
  const newTickets = kitchenIds
    .filter((id) => !hasTicket.has(id))
    .map((orderItemId) => ({ orderItemId, status: KitchenTicketStatus.NEW }));

  await prisma.$transaction([
    prisma.orderItem.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: OrderItemStatus.SENT },
    }),
    ...(newTickets.length > 0
      ? [prisma.kitchenTicket.createMany({ data: newTickets })]
      : []),
    prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SENT_TO_KITCHEN },
    }),
  ]);

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { table: true },
  });

  // TM-m30 キッチン伝票（プリンター障害で注文を止めない）
  const printerConfig = loadPrinterConfig();
  if (printerConfig.ip && printerConfig.printKitchenTicket) {
    const ticket = buildKitchenTicket(
      {
        tableName: order.table.name,
        eatInType: order.eatInType,
        orderNumber: order.orderNumber,
        customerCount: order.customerCount,
        items: pendingItems
          .filter((item) => !isModifierChildLine(item.productId, item.note))
          .map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            note: item.note,
          })),
      },
      printerConfig.cols,
    );
    sendToPrinter(ticket, printerConfig).catch((err) => {
      console.error("[printer] キッチン伝票の印刷に失敗:", err.message);
    });
  }

  return getTableOrder(order.tableId);
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
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { where: { status: { not: OrderItemStatus.CANCELLED } } },
    },
  });

  if (order.status === OrderStatus.PAID) {
    throw new Error("会計済みの取引は中止できません");
  }

  const itemIds = order.items.map((i) => i.id);

  await prisma.$transaction([
    prisma.paymentSession.updateMany({
      where: {
        orderId,
        status: {
          in: [
            PaymentSessionStatus.PENDING,
            PaymentSessionStatus.AWAITING_TERMINAL,
            PaymentSessionStatus.AWAITING_ONLINE,
          ],
        },
      },
      data: { status: PaymentSessionStatus.CANCELLED },
    }),
    prisma.kitchenTicket.deleteMany({
      where: { orderItemId: { in: itemIds } },
    }),
    prisma.orderItem.updateMany({
      where: { orderId, status: { not: OrderItemStatus.CANCELLED } },
      data: { status: OrderItemStatus.CANCELLED },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    }),
    prisma.table.update({
      where: { id: order.tableId },
      data: { status: TableStatus.EMPTY },
    }),
  ]);

  return null;
}

export async function getKitchenTickets() {
  const tickets = await prisma.kitchenTicket.findMany({
    where: { status: { in: [KitchenTicketStatus.NEW, KitchenTicketStatus.COOKING, KitchenTicketStatus.DONE] } },
    include: {
      orderItem: {
        include: { order: { include: { table: true } } },
      },
    },
    orderBy: { queuedAt: "asc" },
  });
  return tickets.filter(
    (t) => !isModifierChildLine(t.orderItem.productId, t.orderItem.note),
  );
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

  if (status === KitchenTicketStatus.COOKING) {
    await prisma.orderItem.update({
      where: { id: ticket.orderItemId },
      data: { status: OrderItemStatus.COOKING },
    });
    await syncModifierBundleSiblings(ticket.orderItem, OrderItemStatus.COOKING);
  }
  if (status === KitchenTicketStatus.DONE) {
    await prisma.orderItem.update({
      where: { id: ticket.orderItemId },
      data: { status: OrderItemStatus.DONE },
    });
    await syncModifierBundleSiblings(ticket.orderItem, OrderItemStatus.DONE);
  }
  if (status === KitchenTicketStatus.SERVED) {
    await prisma.orderItem.update({
      where: { id: ticket.orderItemId },
      data: { status: OrderItemStatus.SERVED },
    });
    await syncModifierBundleSiblings(ticket.orderItem, OrderItemStatus.SERVED);
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

/** 会計・決済開始前の共通チェック */
export async function assertOrderReadyForCheckout(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { where: { status: { not: OrderItemStatus.CANCELLED } } },
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

  const inKitchen = order.items.filter(
    (item) =>
      (item.status === OrderItemStatus.SENT ||
        item.status === OrderItemStatus.COOKING ||
        item.status === OrderItemStatus.DONE) &&
      !isModifierChildLine(item.productId, item.note),
  );
  if (inKitchen.length > 0) {
    throw new Error("調理中または未提供の注文があります。提供完了後に会計してください");
  }

  return order;
}

export async function completeOrderCheckout(
  orderId: string,
  storeId: string,
  paymentMethod: PaymentMethodType = PaymentMethodType.CASH,
  tendered?: number,
  discount = 0,
) {
  await assertOrderReadyForCheckout(orderId);

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

  const subtotalAmount = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = Math.max(0, Math.floor(discount));
  if (discountAmount > subtotalAmount) {
    throw new Error("値引き額が小計を超えています");
  }
  const totalAmount = subtotalAmount - discountAmount;
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
      subtotalAmount,
      discountAmount,
      totalAmount,
      tax10Amount: totalAmount,
      consumptionTax10: Math.round((totalAmount * 10) / 110),
      consumptionTax: Math.round((totalAmount * 10) / 110),
      customerCount: order.customerCount,
      eatInType: order.eatInType,
      staffName: order.staffName,
      tableNumber: order.table.number,
    },
  });

  await prisma.salesTransactionItem.createMany({
    data: order.items.map((item) => ({
      salesTransactionId: tx.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotalAmount: item.unitPrice * item.quantity,
      totalAmount: item.unitPrice * item.quantity,
    })),
  });

  await prisma.salesTransactionPayment.create({
    data: {
      salesTransactionId: tx.id,
      method: paymentMethod,
      amount: totalAmount,
    },
  });

  // ダッシュボード集計は会計レスポンスをブロックしない
  void aggregateSales(storeId, DataSource.OWN_POS).catch((err) => {
    console.error("[checkout] aggregateSales failed:", err);
  });

  // TM-m30 レシート印刷 + ドロワー（失敗しても会計は成立させる）
  const printerConfig = loadPrinterConfig();
  if (printerConfig.ip) {
    const buffers: Buffer[] = [];
    if (paymentMethod === PaymentMethodType.CASH && printerConfig.kickDrawer) {
      buffers.push(buildDrawerKick());
    }
    if (printerConfig.printReceipt) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      const change =
        paymentMethod === PaymentMethodType.CASH && tendered
          ? Math.max(0, tendered - totalAmount)
          : undefined;
      buffers.push(
        buildReceipt(
          {
            storeName: printerConfig.storeName,
            invoiceRegNumber: store?.invoiceRegNumber,
            tableName: order.table.name,
            orderNumber: order.orderNumber,
            customerCount: order.customerCount,
            items: order.items.map((item) => ({
              name: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
            subtotalAmount,
            discountAmount,
            totalAmount,
            taxAmount: Math.round((totalAmount * 10) / 110),
            paymentLabel: PAYMENT_LABELS[paymentMethod] ?? paymentMethod,
            tendered: paymentMethod === PaymentMethodType.CASH ? tendered : undefined,
            change,
          },
          printerConfig.cols,
        ),
      );
    }
    if (buffers.length > 0) {
      sendToPrinter(Buffer.concat(buffers), printerConfig).catch((err) => {
        console.error("[printer] レシート印刷に失敗:", err.message);
      });
    }
  }

  return { totalAmount, orderNumber: order.orderNumber, paymentMethod };
}
