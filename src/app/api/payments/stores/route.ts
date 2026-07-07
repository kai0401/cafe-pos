import { NextResponse } from "next/server";
import {
  confirmStoresTerminalPayment,
  createStoresPaymentSession,
  getActivePaymentSession,
  isStoresApiConfigured,
  isStoresEnabled,
  syncStoresOnlinePayment,
} from "@/domain/payment/stores-payment-service";
import { prisma } from "@/lib/prisma";
import { ensureWaiterSetup } from "@/lib/waiter-setup";

function getBaseUrl(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  try {
    const store = await ensureWaiterSetup();
    if (!(await isStoresEnabled(store.id))) {
      return NextResponse.json({ error: "STORES決済が無効です" }, { status: 400 });
    }

    const body = await request.json();
    const { action, orderId, amount, discount = 0, mode, terminalNote, sessionId } = body;

    if (action === "confirm" && sessionId) {
      const result = await confirmStoresTerminalPayment(sessionId, terminalNote);
      return NextResponse.json(result);
    }

    if (!orderId) {
      return NextResponse.json({ error: "orderId が必要です" }, { status: 400 });
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { where: { status: { not: "CANCELLED" } } },
      },
    });

    const subtotal = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discountAmount = Math.max(0, Math.floor(Number(discount) || 0));
    const payable = amount ?? Math.max(0, subtotal - discountAmount);

    const session = await createStoresPaymentSession({
      orderId,
      storeId: store.id,
      amount: payable,
      discountAmount,
      baseUrl: getBaseUrl(request),
      mode: mode ?? (isStoresApiConfigured() ? "online" : "terminal"),
    });

    return NextResponse.json({
      session,
      apiConfigured: isStoresApiConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "決済エラー" },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    let session = await getActivePaymentSession(orderId);
    if (session?.status === "AWAITING_ONLINE") {
      session = await syncStoresOnlinePayment(session.id);
    }

    return NextResponse.json({
      session,
      apiConfigured: isStoresApiConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得エラー" },
      { status: 400 },
    );
  }
}
