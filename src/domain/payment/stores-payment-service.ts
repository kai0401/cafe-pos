import {
  OrderChannel,
  PaymentMethodType,
  PaymentSessionStatus,
} from "@prisma/client";
import { assertOrderReadyForCheckout, completeOrderCheckout } from "@/domain/order/order-service";
import { generateOrderNumber } from "@/lib/waiter-setup";
import { prisma } from "@/lib/prisma";

const COINEY_API = "https://api.coiney.io/api/v1";

export function isStoresApiConfigured() {
  return Boolean(process.env.STORES_API_KEY?.trim());
}

export async function isStoresEnabled(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  return Boolean(store?.storesEnabled);
}

type CreateSessionInput = {
  orderId: string;
  storeId: string;
  amount: number;
  discountAmount?: number;
  baseUrl: string;
  mode?: "terminal" | "online";
};

export async function createStoresPaymentSession(input: CreateSessionInput) {
  const { orderId, storeId, amount, discountAmount = 0, baseUrl, mode } = input;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { table: true },
  });

  if (order.status === "PAID" || order.status === "CANCELLED") {
    throw new Error("この注文はすでに会計済みです");
  }

  await assertOrderReadyForCheckout(orderId);

  await prisma.paymentSession.updateMany({
    where: {
      orderId,
      status: { in: ["PENDING", "AWAITING_TERMINAL", "AWAITING_ONLINE"] },
    },
    data: { status: PaymentSessionStatus.CANCELLED },
  });

  const useOnline = mode === "online" && isStoresApiConfigured();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const session = await prisma.paymentSession.create({
    data: {
      storeId,
      orderId,
      amount,
      discountAmount,
      status: useOnline
        ? PaymentSessionStatus.PENDING
        : PaymentSessionStatus.AWAITING_TERMINAL,
      expiresAt,
    },
  });

  if (useOnline) {
    const online = await createStoresOnlinePayment({
      sessionId: session.id,
      amount,
      tableName: order.table.name,
      orderNumber: order.orderNumber,
      baseUrl,
    });
    return prisma.paymentSession.update({
      where: { id: session.id },
      data: {
        status: PaymentSessionStatus.AWAITING_ONLINE,
        storesPaymentId: online.storesPaymentId,
        paymentUrl: online.paymentUrl,
      },
    });
  }

  return session;
}

async function createStoresOnlinePayment(params: {
  sessionId: string;
  amount: number;
  tableName: string;
  orderNumber: string;
  baseUrl: string;
}) {
  const apiKey = process.env.STORES_API_KEY?.trim();
  if (!apiKey) throw new Error("STORES APIキーが設定されていません");

  const redirectUrl = `${params.baseUrl}/api/payments/stores/callback?sessionId=${params.sessionId}&result=success`;
  const cancelUrl = `${params.baseUrl}/api/payments/stores/callback?sessionId=${params.sessionId}&result=cancel`;

  const res = await fetch(`${COINEY_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-CoineyPayge-Version": "2016-10-25",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: "jpy",
      locale: "ja_JP",
      redirectUrl,
      cancelUrl,
      method: "creditcard",
      subject: `テーブル ${params.tableName} お会計`,
      description: `order:${params.orderNumber};session:${params.sessionId}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STORES決済の作成に失敗しました: ${text}`);
  }

  const data = (await res.json()) as {
    id?: string;
    links?: { paymentUrl?: string };
  };

  const paymentUrl = data.links?.paymentUrl;
  if (!paymentUrl || !data.id) {
    throw new Error("STORES決済URLの取得に失敗しました");
  }

  return { storesPaymentId: data.id, paymentUrl };
}

export async function syncStoresOnlinePayment(sessionId: string) {
  const session = await prisma.paymentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (!session.storesPaymentId || !isStoresApiConfigured()) {
    return session;
  }

  const apiKey = process.env.STORES_API_KEY!.trim();
  const res = await fetch(`${COINEY_API}/payments/${session.storesPaymentId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-CoineyPayge-Version": "2016-10-25",
      Accept: "application/json",
    },
  });

  if (!res.ok) return session;

  const data = (await res.json()) as { status?: string };
  if (data.status === "paid" || data.status === "captured") {
    const result = await finalizeStoresPayment(sessionId, PaymentMethodType.STORES);
    return result.session;
  }
  if (data.status === "failed" || data.status === "expired") {
    return prisma.paymentSession.update({
      where: { id: sessionId },
      data: { status: PaymentSessionStatus.FAILED },
    });
  }

  return session;
}

export async function confirmStoresTerminalPayment(sessionId: string, terminalNote?: string) {
  const session = await prisma.paymentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (session.status !== PaymentSessionStatus.AWAITING_TERMINAL) {
    throw new Error("この決済セッションは端末確認待ちではありません");
  }

  if (terminalNote) {
    await prisma.paymentSession.update({
      where: { id: sessionId },
      data: { terminalNote },
    });
  }

  return finalizeStoresPayment(sessionId, PaymentMethodType.STORES);
}

export async function finalizeStoresPayment(
  sessionId: string,
  paymentMethod: PaymentMethodType = PaymentMethodType.STORES,
) {
  const session = await prisma.paymentSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { order: true },
  });

  if (session.status === PaymentSessionStatus.PAID) {
    return { session, checkout: null };
  }

  await assertOrderReadyForCheckout(session.orderId);

  const checkout = await completeOrderCheckout(
    session.orderId,
    session.storeId,
    paymentMethod,
    undefined,
    session.discountAmount,
  );

  const paidSession = await prisma.paymentSession.update({
    where: { id: sessionId },
    data: {
      status: PaymentSessionStatus.PAID,
      paymentMethod,
      paidAt: new Date(),
    },
  });

  return { session: paidSession, checkout };
}

export async function getActivePaymentSession(orderId: string) {
  return prisma.paymentSession.findFirst({
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
    orderBy: { createdAt: "desc" },
  });
}

export async function validateQrTableAccess(tableId: string, token: string) {
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) throw new Error("テーブルが見つかりません");
  if (!table.qrEnabled) throw new Error("このテーブルではQRオーダーは無効です");
  if (!table.qrToken || table.qrToken !== token) {
    throw new Error("QRコードが無効です。スタッフにお声がけください");
  }
  return table;
}

export async function openQrTableOrder(
  tableId: string,
  storeId: string,
  customerCount: number,
) {
  const existing = await prisma.order.findFirst({
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
  });

  if (existing) {
    if (existing.channel !== OrderChannel.QR) {
      await prisma.order.update({
        where: { id: existing.id },
        data: { channel: OrderChannel.QR },
      });
    }
    if (existing.customerCount !== customerCount) {
      await prisma.order.update({
        where: { id: existing.id },
        data: { customerCount },
      });
    }
    return prisma.order.findFirstOrThrow({
      where: { id: existing.id },
      include: {
        items: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "asc" },
        },
        table: true,
      },
    });
  }

  const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
  await prisma.order.create({
    data: {
      storeId,
      tableId,
      orderNumber: await generateOrderNumber(storeId),
      eatInType: table.eatInType,
      customerCount,
      channel: OrderChannel.QR,
      status: "OPEN",
    },
  });
  await prisma.table.update({
    where: { id: tableId },
    data: { status: "OCCUPIED" },
  });

  return prisma.order.findFirstOrThrow({
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
  });
}
