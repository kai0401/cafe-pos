import {
  DataSource,
  KitchenTicketStatus,
  OrderChannel,
  OrderItemStatus,
  OrderStatus,
  PaymentMethodType,
  PaymentSessionStatus,
  Prisma,
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
import { isModifierChildLine, countDisplayOrderItems, groupOrderItemsForDisplay, parseModifierBundle } from "@/lib/order-modifiers";
import {
  categoryHasModifiers,
  cupFlavorDisplayName,
  includedSoftCreamFlavor,
  isCrossCategoryModifier,
  isIceCreamTopping,
  allowModifierForProduct,
  isMainProduct,
  isModifierProduct,
  isQrListedProduct,
  isTakeoutSoftCreamFlavor,
  isVesselOption,
  isWaiterListedProduct,
  isSameCategoryModifier,
  isSoftCreamCupFlavor,
  isSoftCreamFlavorOption,
  isSoftCreamRemoval,
  isVanillaMatchaMixFlavor,
  isTakeoutProduct,
  isVanillaSoftCreamCup,
  matchesIncludedFlavor,
  modifierDisplayName,
  takeoutSoftFlavorDisplayName,
  MODIFIER_GROUP_DEFS,
  QR_HIDDEN_CATEGORY_NAMES,
  uniqueProductsByNamePrice,
} from "@/lib/menu-modifiers";
import { productPhotoUrl } from "@/lib/product-photo-url";
import { WAITER_CATEGORY_ORDER } from "@/lib/smaregi-categories";
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
    const inKitchenCount =
      order?.items
        .filter((i) => i.status === OrderItemStatus.SENT || i.status === OrderItemStatus.COOKING)
        .filter((i) => !isModifierChildLine(i.productId, i.note))
        .reduce((s, i) => s + i.quantity, 0) ?? 0;
    const totalCount = order ? countDisplayOrderItems(order.items) : 0;
    const totalAmount = order
      ? groupOrderItemsForDisplay(
          order.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productName: i.productName,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            status: i.status,
            note: i.note,
            createdAt: i.createdAt.toISOString(),
          })),
        ).reduce((s, i) => s + i.lineTotal, 0)
      : 0;
    return {
      id: t.id,
      name: t.name,
      number: t.number,
      eatInType: t.eatInType,
      status: t.status,
      orderId: order?.id ?? null,
      orderChannel: order?.channel ?? null,
      pendingCount,
      inKitchenCount,
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
      const mapped = mapProduct(p, eatInType);
      return isWaiterCard(mapped, cat.name) && mapped.price > 0;
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
  p: {
    id: string;
    name: string;
    priceDineIn: number;
    priceTakeout: number | null;
    status: ProductStatus;
    imagePath?: string | null;
    updatedAt?: Date;
    showOnQr?: boolean | null;
    showOnWaiter?: boolean | null;
    isTopping?: boolean | null;
  },
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
    imageUrl: p.imagePath ? productPhotoUrl(p.id, p.updatedAt) : null,
    showOnQr: p.showOnQr !== false,
    showOnWaiter: p.showOnWaiter !== false,
    isTopping: Boolean(p.isTopping),
  };
}

function isWaiterCard(p: ReturnType<typeof mapProduct>, categoryName?: string) {
  return p.showOnWaiter && !p.isTopping && isWaiterListedProduct(p.name, p.price, categoryName);
}

function isQrCard(p: ReturnType<typeof mapProduct>) {
  return p.showOnQr && !p.isTopping && isQrListedProduct(p.name, p.price);
}

export async function getCategoryProducts(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const category = await prisma.productCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const products = await prisma.product.findMany({
    where: { storeId, categoryId, status: { not: ProductStatus.HIDDEN } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return uniqueProductsByNamePrice(
    products.map((p) => mapProduct(p, eatInType)).filter((p) => isWaiterCard(p, category.name)),
  );
}

/** メニュー管理（売切・価格）用: 本商品のみ（トッピング・値引きSKUは出さない） */
export async function getCategoryProductsAll(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const category = await prisma.productCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const products = await prisma.product.findMany({
    where: { storeId, categoryId, status: { not: ProductStatus.HIDDEN } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return uniqueProductsByNamePrice(
    products
      .map((p) => {
        const mapped = mapProduct(p, eatInType);
        return {
          ...mapped,
          isModifier: mapped.isTopping || isModifierProduct(mapped.name, mapped.price),
          sendToKitchen: p.sendToKitchen,
        };
      })
      .filter((p) => isWaiterCard(p, category.name)),
  );
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
      const products = uniqueProductsByNamePrice(mapped.filter((p) => isWaiterCard(p, cat.name)));
      const hasModifiers = categoryHasModifiers(
        cat.name,
        mapped.filter((p) => p.showOnWaiter),
      );
      return { id: cat.id, name: cat.name, hasModifiers, products };
    })
    .filter((cat) => cat.products.length > 0);
}

function qrProductFrom(
  p: {
    id: string;
    name: string;
    priceDineIn: number;
    priceTakeout: number | null;
    status: ProductStatus;
    imagePath?: string | null;
    updatedAt?: Date;
    showOnQr?: boolean | null;
    showOnWaiter?: boolean | null;
    isTopping?: boolean | null;
  },
  eatInType: "DINE_IN" | "TAKEOUT",
  categoryId: string,
  categoryName: string,
  categoryMapped: { name: string; price: number }[],
) {
  const mapped = mapProduct(p, eatInType);
  return {
    ...mapped,
    categoryId,
    hasModifiers:
      isVanillaSoftCreamCup(mapped.name, mapped.price) ||
      categoryHasModifiers(categoryName, categoryMapped),
  };
}

/** お客さまQR用メニュー。ソフトクリームは甘味に寄せ、テイクアウト・トッピングSKUは出さない */
export async function getQrGuestMenu(storeId: string, eatInType: "DINE_IN" | "TAKEOUT") {
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
  const byName = new Map(sorted.map((c) => [c.name, c]));
  const hidden = new Set<string>(QR_HIDDEN_CATEGORY_NAMES);

  return sorted
    .filter((cat) => !hidden.has(cat.name))
    .map((cat) => {
      const mappedAll = cat.products.map((p) => mapProduct(p, eatInType));
      let products = cat.products
        .map((p) => qrProductFrom(p, eatInType, cat.id, cat.name, mappedAll))
        .filter((p) => isQrCard(p));

      if (cat.name === "あんみつ") {
        const soft = byName.get("ソフトクリーム");
        if (soft) {
          const softMapped = soft.products.map((p) => mapProduct(p, eatInType));
          const extra = soft.products
            .map((p) => qrProductFrom(p, eatInType, soft.id, soft.name, softMapped))
            .filter((p) => isQrCard(p));
          products = [...products, ...extra];
        }
      }

      const unique = uniqueProductsByNamePrice(products);
      return {
        id: cat.id,
        name: cat.name,
        hasModifiers: categoryHasModifiers(
          cat.name,
          mappedAll.filter((p) => p.showOnQr),
        ),
        products: unique,
        productCount: unique.length,
      };
    })
    .filter((cat) => cat.products.length > 0);
}

export async function getQrCategoryProducts(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
) {
  const category = await prisma.productCategory.findUniqueOrThrow({
    where: { id: categoryId },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if ((QR_HIDDEN_CATEGORY_NAMES as readonly string[]).includes(category.name)) return [];

  const mappedAll = category.products.map((p) => mapProduct(p, eatInType));
  let products = category.products
    .map((p) => qrProductFrom(p, eatInType, category.id, category.name, mappedAll))
    .filter((p) => isQrCard(p));

  if (category.name === "あんみつ") {
    const soft = await prisma.productCategory.findFirst({
      where: { storeId, name: "ソフトクリーム" },
      include: {
        products: {
          where: { status: { not: ProductStatus.HIDDEN } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
    if (soft) {
      const softMapped = soft.products.map((p) => mapProduct(p, eatInType));
      const extra = soft.products
        .map((p) => qrProductFrom(p, eatInType, soft.id, soft.name, softMapped))
        .filter((p) => isQrCard(p));
      products = [...products, ...extra];
    }
  }

  return uniqueProductsByNamePrice(products);
}

async function getSoftCreamCupFlavorGroup(storeId: string, eatInType: "DINE_IN" | "TAKEOUT") {
  const source = await prisma.productCategory.findFirst({
    where: { storeId, name: "ソフトクリーム" },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!source) return [];

  const items = uniqueProductsByNamePrice(
    source.products
      .map((p) => mapProduct(p, eatInType))
      .filter(
        (p) =>
          p.showOnQr &&
          !isTakeoutProduct(p.name) &&
          (isVanillaSoftCreamCup(p.name, p.price) ||
            (isSoftCreamCupFlavor(p.name) && p.price >= 400)),
      ),
  );
  if (items.length === 0) return [];

  return [
    {
      name: "ソフトクリーム",
      selection: "single" as const,
      replacesMain: true,
      items: items.map((item) => ({
        ...item,
        displayName: cupFlavorDisplayName(item.name),
      })),
    },
  ];
}

export async function getQrModifierGroups(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
  productName?: string | null,
) {
  const category = await prisma.productCategory.findUniqueOrThrow({ where: { id: categoryId } });
  if (category.name === "ソフトクリーム") {
    return getSoftCreamCupFlavorGroup(storeId, eatInType);
  }
  return getProductModifierGroups(storeId, categoryId, eatInType, productName, "qr");
}

export async function getProductModifierGroups(
  storeId: string,
  categoryId: string,
  eatInType: "DINE_IN" | "TAKEOUT",
  productName?: string | null,
  channel: "qr" | "waiter" = "waiter",
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
  const includedCream = productName ? includedSoftCreamFlavor(productName) : null;

  const groups: {
    name: string;
    selection: "multiple" | "single";
    replacesMain?: boolean;
    flavorChoice?: boolean;
    items: (ReturnType<typeof mapProduct> & { displayName: string; included?: boolean })[];
  }[] = [];

  for (const def of defs) {
    const items: ReturnType<typeof mapProduct>[] = [];
    const seen = new Set<string>();

    // カップ/コーンはカテゴリ誤りでも見つかるよう名前で拾う（店内ソフト専用）
    if (def.kind === "vessel") {
      const vessels = await prisma.product.findMany({
        where: {
          storeId,
          name: { in: ["カップ", "コーン"] },
          status: { not: ProductStatus.HIDDEN },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      for (const product of vessels) {
        const mapped = mapProduct(product, eatInType);
        if (channel === "qr" && !mapped.showOnQr) continue;
        if (channel === "waiter" && !mapped.showOnWaiter) continue;
        if (!isVesselOption(mapped.name) || seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        items.push(mapped);
      }
      const uniqueVessels = uniqueProductsByNamePrice(items);
      if (uniqueVessels.length > 0) {
        groups.push({
          name: def.label,
          selection: "single",
          replacesMain: false,
          items: uniqueVessels.map((item) => ({
            ...item,
            displayName: item.name,
          })),
        });
      }
      continue;
    }

    for (const sourceName of def.sourceCategories) {
      const source = byName.get(sourceName);
      if (!source) continue;

      for (const product of source.products) {
        const mapped = mapProduct(product, eatInType);
        if (channel === "qr" && !mapped.showOnQr) continue;
        if (channel === "waiter" && !mapped.showOnWaiter) continue;
        const heuristic =
          def.kind === "cup-flavor"
            ? isVanillaSoftCreamCup(mapped.name, mapped.price) ||
              (isSoftCreamCupFlavor(mapped.name) && mapped.price >= 400)
            : def.kind === "takeout-flavor"
              ? isTakeoutSoftCreamFlavor(mapped.name)
            : def.kind === "softcream"
              ? isSoftCreamFlavorOption(mapped.name, mapped.price) ||
                isSoftCreamRemoval(mapped.name, mapped.price)
            : def.kind === "icecream"
              ? isIceCreamTopping(mapped.name, mapped.price)
              : def.crossCategory
                ? isCrossCategoryModifier(mapped.name, mapped.price)
                : isSameCategoryModifier(mapped.name, mapped.price);
        const isMod = mapped.isTopping
          ? def.kind === "cup-flavor" ||
              def.kind === "softcream" ||
              def.kind === "icecream" ||
              def.kind === "takeout-flavor"
            ? heuristic
            : true
          : heuristic;
        if (!isMod || seen.has(mapped.id)) continue;
        // テイクアウト味選択以外ではテイクアウトSKUを除外
        if (isTakeoutProduct(mapped.name) && def.kind !== "takeout-flavor") continue;
        if (
          !allowModifierForProduct(
            category.name,
            productName,
            mapped.name,
            mapped.price,
            def.kind,
          )
        ) {
          continue;
        }
        seen.add(mapped.id);
        items.push(mapped);
      }
    }

    const flavorChoice = def.kind === "softcream" && includedCream != null;
    const filtered =
      def.kind === "softcream"
        ? items.filter((item) => {
            if (flavorChoice) return isVanillaMatchaMixFlavor(item.name);
            if (isSoftCreamRemoval(item.name, item.price)) return false;
            return true;
          })
        : items;

    // テイクアウト味は表示名（バニラ/抹茶/ミックス）で1つにまとめる
    const unique =
      def.kind === "takeout-flavor"
        ? uniqueByDisplayName(
            filtered.map((item) => ({
              ...item,
              displayName: takeoutSoftFlavorDisplayName(item.name),
            })),
          )
        : uniqueProductsByNamePrice(filtered);
    if (unique.length === 0) continue;

    const flavorRank = (name: string) => {
      const label = cupFlavorDisplayName(name);
      if (label === "バニラ") return 0;
      if (label === "抹茶") return 1;
      if (label === "ミックス") return 2;
      return 3;
    };
    const ordered =
      def.kind === "softcream"
        ? [...unique].sort((a, b) => {
            if (flavorChoice) return flavorRank(a.name) - flavorRank(b.name);
            const rank = (item: (typeof unique)[number]) => {
              if (matchesIncludedFlavor(item.name, includedCream)) return 0;
              if (isSoftCreamRemoval(item.name, item.price)) return 2;
              return 1;
            };
            return rank(a) - rank(b);
          })
        : unique;

    groups.push({
      name: flavorChoice
        ? "味"
        : def.kind === "softcream"
          ? "ソフトクリーム（追加）"
          : def.label,
      selection:
        def.kind === "softcream" ||
        def.kind === "cup-flavor" ||
        def.kind === "takeout-flavor"
          ? "single"
          : "multiple",
      replacesMain: def.kind === "cup-flavor" || def.kind === "takeout-flavor",
      flavorChoice,
      items: ordered.map((item) => {
        const included = def.kind === "softcream" && matchesIncludedFlavor(item.name, includedCream);
        return {
          ...item,
          price: flavorChoice || included ? 0 : item.price,
          included,
          displayName:
            def.kind === "cup-flavor"
              ? cupFlavorDisplayName(item.name)
              : def.kind === "takeout-flavor"
                ? "displayName" in item && typeof item.displayName === "string"
                  ? item.displayName
                  : takeoutSoftFlavorDisplayName(item.name)
                : def.kind === "softcream"
                  ? isSoftCreamRemoval(item.name, item.price)
                    ? modifierDisplayName(item.name)
                    : cupFlavorDisplayName(item.name)
                : def.kind === "topping"
                  ? modifierDisplayName(item.name)
                  : item.name,
        };
      }),
    });
  }

  return groups;
}

function uniqueByDisplayName<T extends { name: string; price: number; displayName: string }>(
  items: T[],
): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const existing = best.get(item.displayName);
    if (!existing) {
      best.set(item.displayName, item);
      continue;
    }
    // バニラは「バニラ テイクアウト」を優先、それ以外は高い方
    const preferNew =
      item.displayName === "バニラ"
        ? item.name.includes("バニラ") && !existing.name.includes("バニラ")
        : item.price > existing.price;
    if (preferNew) best.set(item.displayName, item);
  }
  return items.filter((item) => best.get(item.displayName) === item);
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
      if (!mapped.showOnWaiter) continue;
      if (!mapped.isTopping && !isModifierProduct(mapped.name, mapped.price)) continue;
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
    .map(([name, products]) => ({
      id: name,
      name,
      products: uniqueProductsByNamePrice(products),
    }));
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

type AdminProductPatch = {
  name?: string;
  categoryId?: string | null;
  priceDineIn?: number;
  priceTakeout?: number | null;
  status?: ProductStatus;
  isTopping?: boolean;
  showOnQr?: boolean;
  showOnWaiter?: boolean;
};

function assertPrice(value: number, label: string) {
  if (!Number.isInteger(value) || value < -10000 || value > 100000) {
    throw new Error(`${label}が不正です`);
  }
}

export async function createStoreProduct(
  storeId: string,
  input: {
    name: string;
    categoryId: string;
    priceDineIn: number;
    priceTakeout?: number | null;
    isTopping?: boolean;
    showOnQr?: boolean;
    showOnWaiter?: boolean;
  },
) {
  const name = input.name.trim();
  if (!name) throw new Error("商品名を入力してください");
  assertPrice(input.priceDineIn, "イートイン価格");
  if (input.priceTakeout != null) assertPrice(input.priceTakeout, "テイクアウト価格");

  const category = await prisma.productCategory.findFirst({
    where: { id: input.categoryId, storeId },
  });
  if (!category) throw new Error("カテゴリが見つかりません");

  const maxSort = await prisma.product.aggregate({
    where: { storeId, categoryId: input.categoryId },
    _max: { sortOrder: true },
  });

  return prisma.product.create({
    data: {
      storeId,
      categoryId: input.categoryId,
      name,
      priceDineIn: input.priceDineIn,
      priceTakeout: input.priceTakeout ?? null,
      isTopping: Boolean(input.isTopping),
      showOnQr: input.showOnQr !== false,
      showOnWaiter: input.showOnWaiter !== false,
      dataSource: DataSource.OWN_POS,
      sendToKitchen: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    include: { category: true, externalMapping: true },
  });
}

export async function updateStoreProduct(storeId: string, productId: string, patch: AdminProductPatch) {
  const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!existing) throw new Error("商品が見つかりません");

  const data: Prisma.ProductUpdateInput = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("商品名を入力してください");
    data.name = name;
  }
  if (patch.categoryId !== undefined) {
    if (patch.categoryId === null) {
      data.category = { disconnect: true };
    } else {
      const category = await prisma.productCategory.findFirst({
        where: { id: patch.categoryId, storeId },
      });
      if (!category) throw new Error("カテゴリが見つかりません");
      data.category = { connect: { id: patch.categoryId } };
    }
  }
  if (patch.priceDineIn !== undefined) {
    assertPrice(patch.priceDineIn, "イートイン価格");
    data.priceDineIn = patch.priceDineIn;
  }
  if (patch.priceTakeout !== undefined) {
    if (patch.priceTakeout !== null) assertPrice(patch.priceTakeout, "テイクアウト価格");
    data.priceTakeout = patch.priceTakeout;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.isTopping !== undefined) data.isTopping = patch.isTopping;
  if (patch.showOnQr !== undefined) data.showOnQr = patch.showOnQr;
  if (patch.showOnWaiter !== undefined) data.showOnWaiter = patch.showOnWaiter;

  if (Object.keys(data).length === 0) throw new Error("更新する項目がありません");

  return prisma.product.update({
    where: { id: productId },
    data,
    include: { category: true, externalMapping: true },
  });
}

export async function hideStoreProduct(storeId: string, productId: string) {
  const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!existing) throw new Error("商品が見つかりません");
  return prisma.product.update({
    where: { id: productId },
    data: { status: ProductStatus.HIDDEN, showOnQr: false, showOnWaiter: false },
    include: { category: true, externalMapping: true },
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
  await pruneOrphanModifierChildren(tableId);
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

/** 本体が取消済みで残ったトッピング行を掃除 */
async function pruneOrphanModifierChildren(tableId: string) {
  const order = await prisma.order.findFirst({
    where: {
      tableId,
      status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return;

  const active = order.items.filter((i) => i.status !== OrderItemStatus.CANCELLED);
  const mainNotes = new Set(
    active
      .filter((i) => !isModifierChildLine(i.productId, i.note))
      .map((i) => i.note)
      .filter((n): n is string => Boolean(n && parseModifierBundle(n))),
  );

  const orphanIds = active
    .filter((i) => isModifierChildLine(i.productId, i.note) && i.note && !mainNotes.has(i.note))
    .map((i) => i.id);

  if (orphanIds.length === 0) return;

  await prisma.$transaction([
    prisma.kitchenTicket.deleteMany({ where: { orderItemId: { in: orphanIds } } }),
    prisma.orderItem.updateMany({
      where: { id: { in: orphanIds } },
      data: { status: OrderItemStatus.CANCELLED },
    }),
  ]);
}

const ACTIVE_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.READY,
] as const;

type TxClient = Prisma.TransactionClient;

async function getTableOrderWithTx(tx: TxClient, tableId: string) {
  return tx.order.findFirst({
    where: {
      tableId,
      status: { in: [...ACTIVE_ORDER_STATUSES] },
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

async function generateOrderNumberTx(tx: TxClient, storeId: string): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await tx.order.count({
    where: { storeId, createdAt: { gte: start } },
  });
  const d = new Date();
  const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function ensureActiveTableOrder(
  tx: TxClient,
  params: {
    tableId: string;
    storeId: string;
    customerCount: number;
    channel?: OrderChannel;
  },
) {
  const { tableId, storeId, customerCount, channel } = params;
  const existing = await getTableOrderWithTx(tx, tableId);
  if (existing) {
    const patch: { customerCount?: number; channel?: OrderChannel } = {};
    if (existing.customerCount !== customerCount) patch.customerCount = customerCount;
    if (channel && existing.channel !== channel) patch.channel = channel;
    if (Object.keys(patch).length > 0) {
      await tx.order.update({ where: { id: existing.id }, data: patch });
      return getTableOrderWithTx(tx, tableId);
    }
    return existing;
  }

  const table = await tx.table.findUniqueOrThrow({ where: { id: tableId } });
  await tx.order.create({
    data: {
      storeId,
      tableId,
      orderNumber: await generateOrderNumberTx(tx, storeId),
      eatInType: table.eatInType,
      customerCount,
      channel: channel ?? OrderChannel.WAITER,
      status: OrderStatus.OPEN,
    },
  });
  await tx.table.update({ where: { id: tableId }, data: { status: TableStatus.OCCUPIED } });
  return getTableOrderWithTx(tx, tableId);
}

export async function openTableOrder(
  tableId: string,
  storeId: string,
  customerCount: number,
) {
  return prisma.$transaction(
    (tx) =>
      ensureActiveTableOrder(tx, {
        tableId,
        storeId,
        customerCount,
        channel: OrderChannel.WAITER,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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

/** ウェイターが配膳完了をマーク（SENT〜DONE から提供可） */
export async function markItemServed(itemId: string) {
  const current = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } });
  if (
    current.status !== OrderItemStatus.SENT &&
    current.status !== OrderItemStatus.COOKING &&
    current.status !== OrderItemStatus.DONE
  ) {
    throw new Error("この商品は提供済みにできません");
  }

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
  const existing = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true },
  });
  if (!existing) throw new Error("注文が見つかりません");
  if (existing.order.status === OrderStatus.PAID) {
    throw new Error("会計済みの注文は変更できません");
  }

  if (quantity <= 0) {
    await cancelOrderItem(itemId);
    return;
  }

  if (existing.status !== OrderItemStatus.PENDING) {
    throw new Error("送信済みの注文は数量変更できません。取消してから再度注文してください");
  }
  await prisma.orderItem.update({ where: { id: itemId }, data: { quantity } });
}

/** 商品単体の取消（未送信・送信済みどちらも可。トッピング同梱もまとめて取消） */
export async function cancelOrderItem(itemId: string) {
  const existing = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true },
  });
  if (!existing) throw new Error("注文が見つかりません");
  if (existing.order.status === OrderStatus.PAID) {
    throw new Error("会計済みの注文は取消できません");
  }
  if (existing.status === OrderItemStatus.CANCELLED) {
    return;
  }

  const siblingIds = new Set<string>([existing.id]);
  if (parseModifierBundle(existing.note)) {
    const siblings = await prisma.orderItem.findMany({
      where: {
        orderId: existing.orderId,
        note: existing.note,
        id: { not: existing.id },
        status: { not: OrderItemStatus.CANCELLED },
      },
      select: { id: true },
    });
    for (const s of siblings) siblingIds.add(s.id);
  }

  const ids = [...siblingIds];
  await prisma.$transaction([
    prisma.kitchenTicket.deleteMany({ where: { orderItemId: { in: ids } } }),
    prisma.orderItem.updateMany({
      where: { id: { in: ids } },
      data: { status: OrderItemStatus.CANCELLED },
    }),
  ]);

  const remaining = await prisma.orderItem.count({
    where: { orderId: existing.orderId, status: { not: OrderItemStatus.CANCELLED } },
  });

  if (remaining === 0) {
    await prisma.order.update({
      where: { id: existing.orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    await prisma.table.update({
      where: { id: existing.order.tableId },
      data: { status: TableStatus.EMPTY },
    });
    return;
  }

  await syncOrderStatusFromItems(existing.orderId);
}

export async function sendOrderToKitchen(orderId: string) {
  const result = await prisma.$transaction(
    async (tx) => {
      const pendingItems = await tx.orderItem.findMany({
        where: { orderId, status: OrderItemStatus.PENDING },
        include: { product: true },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { table: true },
      });

      if (pendingItems.length === 0) {
        return { order, slipItems: [] as typeof pendingItems };
      }

      const pendingIds = pendingItems.map((i) => i.id);
      const kitchenIds = pendingItems
        .filter(
          (i) =>
            i.product.sendToKitchen && !isModifierChildLine(i.productId, i.note),
        )
        .map((i) => i.id);
      const autoServeIds = pendingItems
        .filter((i) => !i.product.sendToKitchen)
        .map((i) => i.id);

      if (autoServeIds.length > 0) {
        // キッチン不要商品（ドリンク等）は送信と同時に提供済み扱い
        await tx.orderItem.updateMany({
          where: { id: { in: autoServeIds }, status: OrderItemStatus.PENDING },
          data: { status: OrderItemStatus.SERVED },
        });
      }

      const sentIds = pendingIds.filter((id) => !autoServeIds.includes(id));
      if (sentIds.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: sentIds }, status: OrderItemStatus.PENDING },
          data: { status: OrderItemStatus.SENT },
        });
      }
      if (kitchenIds.length > 0) {
        await tx.kitchenTicket.createMany({
          data: kitchenIds.map((orderItemId) => ({
            orderItemId,
            status: KitchenTicketStatus.NEW,
          })),
          skipDuplicates: true,
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          status:
            kitchenIds.length > 0 || sentIds.length > 0
              ? OrderStatus.SENT_TO_KITCHEN
              : OrderStatus.READY,
        },
      });

      return { order, slipItems: pendingItems };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  const order = result.order;
  const slipItems = result.slipItems;

  if (slipItems.length === 0) {
    return getTableOrder(order.tableId);
  }

  // TM-m30 注文伝票（プリンター障害で注文を止めない）
  const printerConfig = loadPrinterConfig();
  if (printerConfig.ip && printerConfig.printKitchenTicket) {
    const displayItems = groupOrderItemsForDisplay(
      slipItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
    );
    const ticket = buildKitchenTicket(
      {
        tableName: order.table.name,
        eatInType: order.eatInType,
        orderNumber: order.orderNumber,
        customerCount: order.customerCount,
        staffName: order.staffName,
        items: displayItems.map((item) => ({
          name: item.displayName,
          quantity: item.quantity,
          unitPrice: Math.round(item.lineTotal / Math.max(1, item.quantity)),
          lineTotal: item.lineTotal,
          note: null,
        })),
      },
      printerConfig.cols,
    );
    sendToPrinter(ticket, printerConfig, "kitchen").catch((err) => {
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
      paymentSessions: {
        where: {
          status: {
            in: [
              PaymentSessionStatus.PENDING,
              PaymentSessionStatus.AWAITING_TERMINAL,
              PaymentSessionStatus.AWAITING_ONLINE,
            ],
          },
        },
      },
    },
  });

  if (order.status === OrderStatus.PAID) {
    throw new Error("会計済みの取引は中止できません");
  }

  if (
    order.paymentSessions.some(
      (s) => s.status === PaymentSessionStatus.AWAITING_ONLINE && s.storesPaymentId,
    )
  ) {
    throw new Error(
      "オンライン決済の待ちがあります。お客様に完了またはキャンセルしてもらってから取引中止してください",
    );
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

async function assertNoAwaitingOnlinePayment(orderId: string) {
  const pending = await prisma.paymentSession.findFirst({
    where: {
      orderId,
      status: PaymentSessionStatus.AWAITING_ONLINE,
      storesPaymentId: { not: null },
    },
  });
  if (pending) {
    throw new Error(
      "オンライン決済の待ちがあります。完了またはキャンセル後に操作してください",
    );
  }
}

function collectBundleItemIds(
  items: { id: string; productId: string; note: string | null }[],
  selectedIds: string[],
): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = new Set<string>();
  for (const id of selectedIds) {
    const item = byId.get(id);
    if (!item) continue;
    ids.add(item.id);
    if (!item.note || !parseModifierBundle(item.note)) continue;
    for (const sibling of items) {
      if (sibling.note === item.note) ids.add(sibling.id);
    }
  }
  return [...ids];
}

/** テーブル移動：注文ごと別テーブルへ */
export async function moveOrderToTable(orderId: string, targetTableId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { table: true },
  });
  if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
    throw new Error("この取引は移動できません");
  }
  if (order.tableId === targetTableId) {
    throw new Error("同じテーブルです");
  }
  await assertNoAwaitingOnlinePayment(orderId);

  const target = await prisma.table.findUniqueOrThrow({ where: { id: targetTableId } });
  if (target.storeId !== order.storeId) throw new Error("別店舗のテーブルです");

  const existing = await getTableOrder(targetTableId);
  if (existing) throw new Error(`${target.name} にはすでに注文があります。結合を使ってください`);

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { tableId: targetTableId, eatInType: target.eatInType },
    }),
    prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.EMPTY } }),
    prisma.table.update({ where: { id: targetTableId }, data: { status: TableStatus.OCCUPIED } }),
  ]);

  return { tableId: targetTableId, order: await getTableOrder(targetTableId) };
}

/** テーブル分割：選んだ商品を別テーブルの新規注文へ移す */
export async function splitOrderToTable(
  orderId: string,
  targetTableId: string,
  itemIds: string[],
) {
  if (!itemIds.length) throw new Error("分割する商品を選んでください");

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { where: { status: { not: OrderItemStatus.CANCELLED } } },
      table: true,
    },
  });
  if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
    throw new Error("この取引は分割できません");
  }
  if (order.tableId === targetTableId) throw new Error("同じテーブルです");
  await assertNoAwaitingOnlinePayment(orderId);

  const target = await prisma.table.findUniqueOrThrow({ where: { id: targetTableId } });
  if (target.storeId !== order.storeId) throw new Error("別店舗のテーブルです");
  if (await getTableOrder(targetTableId)) {
    throw new Error(`${target.name} にはすでに注文があります。空のテーブルを選んでください`);
  }

  const moveIds = collectBundleItemIds(order.items, itemIds);
  if (moveIds.length === 0) throw new Error("分割する商品が見つかりません");
  if (moveIds.length >= order.items.length) {
    throw new Error("全品の分割はテーブル移動を使ってください");
  }

  const newOrderId = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        storeId: order.storeId,
        tableId: targetTableId,
        orderNumber: await generateOrderNumberTx(tx, order.storeId),
        status: order.status === OrderStatus.OPEN ? OrderStatus.OPEN : OrderStatus.SENT_TO_KITCHEN,
        channel: OrderChannel.WAITER,
        eatInType: target.eatInType,
        customerCount: 1,
        staffName: order.staffName,
      },
    });
    await tx.orderItem.updateMany({
      where: { id: { in: moveIds } },
      data: { orderId: created.id },
    });
    await tx.table.update({ where: { id: targetTableId }, data: { status: TableStatus.OCCUPIED } });
    return created.id;
  });

  await syncOrderStatusFromItems(orderId);
  await syncOrderStatusFromItems(newOrderId);

  return {
    sourceOrder: await getTableOrder(order.tableId),
    targetTableId,
    targetOrder: await getTableOrder(targetTableId),
  };
}

/** テーブル結合：他テーブルの注文をこの注文へ取り込む */
export async function mergeOrdersInto(targetOrderId: string, sourceOrderId: string) {
  if (targetOrderId === sourceOrderId) throw new Error("同じ注文です");

  const [target, source] = await Promise.all([
    prisma.order.findUniqueOrThrow({
      where: { id: targetOrderId },
      include: { items: { where: { status: { not: OrderItemStatus.CANCELLED } } }, table: true },
    }),
    prisma.order.findUniqueOrThrow({
      where: { id: sourceOrderId },
      include: { items: { where: { status: { not: OrderItemStatus.CANCELLED } } }, table: true },
    }),
  ]);

  if (
    target.status === OrderStatus.PAID ||
    target.status === OrderStatus.CANCELLED ||
    source.status === OrderStatus.PAID ||
    source.status === OrderStatus.CANCELLED
  ) {
    throw new Error("会計済みまたは取消済みの取引は結合できません");
  }
  await assertNoAwaitingOnlinePayment(targetOrderId);
  await assertNoAwaitingOnlinePayment(sourceOrderId);

  const sourceItemIds = source.items.map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    if (sourceItemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: sourceItemIds } },
        data: { orderId: targetOrderId },
      });
    }
    await tx.paymentSession.updateMany({
      where: {
        orderId: sourceOrderId,
        status: {
          in: [
            PaymentSessionStatus.PENDING,
            PaymentSessionStatus.AWAITING_TERMINAL,
            PaymentSessionStatus.AWAITING_ONLINE,
          ],
        },
      },
      data: { status: PaymentSessionStatus.CANCELLED },
    });
    await tx.order.update({
      where: { id: sourceOrderId },
      data: { status: OrderStatus.CANCELLED },
    });
    await tx.table.update({
      where: { id: source.tableId },
      data: { status: TableStatus.EMPTY },
    });
    await tx.order.update({
      where: { id: targetOrderId },
      data: {
        customerCount: Math.max(1, target.customerCount + source.customerCount),
        status:
          target.status === OrderStatus.OPEN && source.status !== OrderStatus.OPEN
            ? OrderStatus.SENT_TO_KITCHEN
            : target.status,
      },
    });
  });

  await syncOrderStatusFromItems(targetOrderId);
  return getTableOrder(target.tableId);
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

  // SENT/COOKING のみ会計不可。PENDING（未送信）・DONE・SERVED は会計可
  const inKitchen = order.items.filter(
    (item) =>
      (item.status === OrderItemStatus.SENT || item.status === OrderItemStatus.COOKING) &&
      !isModifierChildLine(item.productId, item.note),
  );
  if (inKitchen.length > 0) {
    throw new Error("調理中の注文があります。調理完了後に会計してください");
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
  const checkout = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: {
          where: { status: { not: OrderItemStatus.CANCELLED } },
          include: { product: true },
        },
        table: true,
      },
    });

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error("この取引はキャンセル済みです");
    }

    // 再送・二重確定への冪等応答
    if (order.status === OrderStatus.PAID) {
      const existing = await tx.salesTransaction.findUnique({
        where: {
          dataSource_externalId: {
            dataSource: DataSource.OWN_POS,
            externalId: `pos-${order.orderNumber}`,
          },
        },
      });
      return {
        totalAmount: existing?.totalAmount ?? 0,
        orderNumber: order.orderNumber,
        paymentMethod,
        subtotalAmount: existing?.subtotalAmount ?? 0,
        discountAmount: existing?.discountAmount ?? 0,
        alreadyPaid: true as const,
        order,
      };
    }

    if (order.items.length === 0) {
      throw new Error("注文がありません");
    }

    const inKitchen = order.items.filter(
      (item) =>
        (item.status === OrderItemStatus.SENT || item.status === OrderItemStatus.COOKING) &&
        !isModifierChildLine(item.productId, item.note),
    );
    if (inKitchen.length > 0) {
      throw new Error("調理中の注文があります。調理完了後に会計してください");
    }

    const subtotalAmount = order.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discountAmount = Math.max(0, Math.floor(discount));
    if (discountAmount > subtotalAmount) {
      throw new Error("値引き額が小計を超えています");
    }
    const totalAmount = subtotalAmount - discountAmount;
    const itemIds = order.items.map((item) => item.id);

    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
      },
      data: { status: OrderStatus.PAID },
    });
    if (claimed.count === 0) {
      const raced = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            where: { status: { not: OrderItemStatus.CANCELLED } },
            include: { product: true },
          },
          table: true,
        },
      });
      if (raced.status === OrderStatus.PAID) {
        const existing = await tx.salesTransaction.findUnique({
          where: {
            dataSource_externalId: {
              dataSource: DataSource.OWN_POS,
              externalId: `pos-${raced.orderNumber}`,
            },
          },
        });
        return {
          totalAmount: existing?.totalAmount ?? 0,
          orderNumber: raced.orderNumber,
          paymentMethod,
          subtotalAmount: existing?.subtotalAmount ?? 0,
          discountAmount: existing?.discountAmount ?? 0,
          alreadyPaid: true as const,
          order: raced,
        };
      }
      throw new Error("この取引はすでに完了しています");
    }

    await tx.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { status: OrderItemStatus.SERVED },
    });

    await tx.kitchenTicket.updateMany({
      where: {
        orderItemId: { in: itemIds },
        status: { not: KitchenTicketStatus.SERVED },
      },
      data: { status: KitchenTicketStatus.SERVED, doneAt: new Date() },
    });

    await tx.table.update({
      where: { id: order.tableId },
      data: { status: TableStatus.EMPTY },
    });

    const businessDate = getBusinessDate(new Date());
    const salesTx = await tx.salesTransaction.create({
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
        customerSegment: order.customerSegment,
        tableNumber: order.table.number,
        tableName: order.table.name,
        entryTime: order.createdAt,
      },
    });

    await tx.salesTransactionItem.createMany({
      data: order.items.map((item) => ({
        salesTransactionId: salesTx.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotalAmount: item.unitPrice * item.quantity,
        totalAmount: item.unitPrice * item.quantity,
      })),
    });

    await tx.salesTransactionPayment.create({
      data: {
        salesTransactionId: salesTx.id,
        method: paymentMethod,
        amount: totalAmount,
      },
    });

    return {
      totalAmount,
      orderNumber: order.orderNumber,
      paymentMethod,
      subtotalAmount,
      discountAmount,
      alreadyPaid: false as const,
      order,
    };
  });

  if (!checkout.alreadyPaid) {
    void aggregateSales(storeId, DataSource.OWN_POS).catch((err) => {
      console.error("[checkout] aggregateSales failed:", err);
    });
  }

  const { order, subtotalAmount, discountAmount, totalAmount } = checkout;

  // TM-m30 レシート印刷 + ドロワー（失敗しても会計は成立させる）
  if (!checkout.alreadyPaid) {
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
        sendToPrinter(Buffer.concat(buffers), printerConfig, "receipt").catch((err) => {
          console.error("[printer] レシート印刷に失敗:", err.message);
        });
      }
    }
  }

  return {
    totalAmount: checkout.totalAmount,
    orderNumber: checkout.orderNumber,
    paymentMethod: checkout.paymentMethod,
  };
}
