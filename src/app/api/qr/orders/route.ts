import { PaymentSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  addAndSendOrderItems,
  addOrderItems,
  assertOrderReadyForCheckout,
  getCategoryProducts,
  getFullMenu,
  getProductModifierGroups,
  sendOrderToKitchen,
} from "@/domain/order/order-service";
import {
  createStoresPaymentSession,
  getActivePaymentSession,
  isStoresApiConfigured,
  isStoresEnabled,
  openQrTableOrder,
  syncStoresOnlinePayment,
  validateQrTableAccess,
} from "@/domain/payment/stores-payment-service";
import { getDefaultStore } from "@/lib/prisma";
import { ensureWaiterSetup } from "@/lib/waiter-setup";

function getBaseUrl(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function requireQrAccess(tableId: string, token: string) {
  const table = await validateQrTableAccess(tableId, token);
  const store = await getDefaultStore();
  return { table, store };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tableId = url.searchParams.get("tableId");
    const token = url.searchParams.get("token");
    const syncPayment = url.searchParams.get("syncPayment") === "1";

    if (!tableId || !token) {
      return NextResponse.json({ error: "tableId と token が必要です" }, { status: 400 });
    }

    const { table, store } = await requireQrAccess(tableId, token);
    const order = await import("@/lib/prisma").then((m) =>
      m.prisma.order.findFirst({
        where: {
          tableId,
          status: { in: ["OPEN", "SENT_TO_KITCHEN", "READY"] },
        },
        include: {
          items: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { createdAt: "asc" },
          },
          table: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    let paymentSession = order ? await getActivePaymentSession(order.id) : null;
    if (!paymentSession) {
      const recentPaid = await import("@/lib/prisma").then((m) =>
        m.prisma.paymentSession.findFirst({
          where: {
            order: { tableId },
            status: PaymentSessionStatus.PAID,
            paidAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
          },
          orderBy: { paidAt: "desc" },
        }),
      );
      if (recentPaid) paymentSession = recentPaid;
    }
    if (syncPayment && paymentSession?.status === "AWAITING_ONLINE") {
      paymentSession = await syncStoresOnlinePayment(paymentSession.id);
    }

    return NextResponse.json({
      table: { id: table.id, name: table.name, eatInType: table.eatInType },
      order,
      storesEnabled: await isStoresEnabled(store.id),
      storesApiConfigured: isStoresApiConfigured(),
      paymentSession,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "アクセスエラー" },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tableId, token, action, customerCount, items, orderId, mode } = body;

    if (!tableId || !token) {
      return NextResponse.json({ error: "tableId と token が必要です" }, { status: 400 });
    }

    const { table, store } = await requireQrAccess(tableId, token);

    if (action === "start") {
      const count = Math.max(1, Math.min(20, Number(customerCount) || 1));
      const order = await openQrTableOrder(tableId, store.id, count);
      return NextResponse.json({ table, order });
    }

    if (action === "menu") {
      const eatInType = table.eatInType;
      const categoryId = body.categoryId as string | undefined;
      if (body.modifiers && categoryId) {
        const groups = await getProductModifierGroups(store.id, categoryId, eatInType);
        return NextResponse.json(groups);
      }
      if (categoryId) {
        const products = await getCategoryProducts(store.id, categoryId, eatInType);
        return NextResponse.json(products);
      }
      const menu = await getFullMenu(store.id, eatInType);
      return NextResponse.json(
        menu.map((c) => ({
          id: c.id,
          name: c.name,
          productCount: c.products.length,
          hasModifiers: c.hasModifiers,
        })),
      );
    }

    if (action === "add" && items?.length) {
      const order = await addOrderItems(tableId, store.id, items);
      return NextResponse.json(order);
    }

    if (action === "addAndSend" && items?.length) {
      const order = await addAndSendOrderItems(tableId, store.id, items);
      return NextResponse.json(order);
    }

    if (action === "send" && orderId) {
      const order = await sendOrderToKitchen(orderId);
      return NextResponse.json(order);
    }

    if (action === "pay" && orderId) {
      if (!(await isStoresEnabled(store.id))) {
        return NextResponse.json({ error: "STORES決済が無効です" }, { status: 400 });
      }
      await assertOrderReadyForCheckout(orderId);
      const orderItems = await import("@/lib/prisma").then((m) =>
        m.prisma.orderItem.findMany({
          where: { orderId, status: { not: "CANCELLED" } },
        }),
      );
      const amount = orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const session = await createStoresPaymentSession({
        orderId,
        storeId: store.id,
        amount,
        baseUrl: getBaseUrl(request),
        mode: mode ?? "online",
      });
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "QRオーダーエラー" },
      { status: 400 },
    );
  }
}
