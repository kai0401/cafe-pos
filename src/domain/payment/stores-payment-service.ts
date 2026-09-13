import {
  DataSource,
  OrderChannel,
  PaymentMethodType,
  PaymentSessionStatus,
  Prisma,
  TransactionType,
} from "@prisma/client";
import { assertOrderReadyForCheckout, completeOrderCheckout } from "@/domain/order/order-service";
import { getBusinessDate } from "@/lib/datetime";
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

async function cancelRemoteStoresPayment(storesPaymentId: string) {
  const apiKey = process.env.STORES_API_KEY?.trim();
  if (!apiKey) return;
  try {
    await fetch(`${COINEY_API}/payments/${storesPaymentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-CoineyPayge-Version": "2016-10-25",
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.warn("[stores] remote cancel failed:", storesPaymentId, err);
  }
}

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

  const prior = await prisma.paymentSession.findMany({
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
  });

  for (const old of prior) {
    if (old.storesPaymentId) {
      void cancelRemoteStoresPayment(old.storesPaymentId);
    }
  }

  await prisma.paymentSession.updateMany({
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
    try {
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
    } catch (err) {
      await prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: PaymentSessionStatus.FAILED },
      });
      throw err;
    }
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
      method: "creditcard", // オンライン請求はカード。QR/電子マネーは STORES 端末で会計
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

  if (session.status === PaymentSessionStatus.PAID) {
    return session;
  }

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

  if (!res.ok) {
    throw new Error(`STORES決済の確認に失敗しました (${res.status})`);
  }

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

  // 注文が既に会計済みならセッションだけ揃える（部分成功の復旧）
  if (session.order.status === "PAID") {
    const paidSession = await prisma.paymentSession.update({
      where: { id: sessionId },
      data: {
        status: PaymentSessionStatus.PAID,
        paymentMethod,
        paidAt: new Date(),
      },
    });
    return { session: paidSession, checkout: null };
  }

  // 注文が取消済みでもリモート支払済みなら売上だけ回収
  if (session.order.status === "CANCELLED") {
    const businessDate = getBusinessDate(new Date());
    const externalId = `stores-orphan-${session.id}`;
    const existing = await prisma.salesTransaction.findUnique({
      where: {
        dataSource_externalId: {
          dataSource: DataSource.OWN_POS,
          externalId,
        },
      },
    });
    if (!existing) {
      await prisma.salesTransaction.create({
        data: {
          storeId: session.storeId,
          externalId,
          dataSource: DataSource.OWN_POS,
          transactionType: TransactionType.SALE,
          transactionAt: new Date(),
          businessDate,
          subtotalAmount: session.amount,
          discountAmount: session.discountAmount,
          totalAmount: session.amount,
          tax10Amount: session.amount,
          consumptionTax10: Math.round((session.amount * 10) / 110),
          consumptionTax: Math.round((session.amount * 10) / 110),
          customerCount: session.order.customerCount || 1,
          staffName: session.order.staffName,
          customerSegment: session.order.customerSegment,
          entryTime: session.order.createdAt,
          payments: {
            create: { method: paymentMethod, amount: session.amount },
          },
        },
      });
    }
    const paidSession = await prisma.paymentSession.update({
      where: { id: sessionId },
      data: {
        status: PaymentSessionStatus.PAID,
        paymentMethod,
        paidAt: new Date(),
      },
    });
    return { session: paidSession, checkout: { orphanRecovered: true } };
  }

  await assertOrderReadyForCheckout(session.orderId);

  const checkout = await completeOrderCheckout(
    session.orderId,
    session.storeId,
    paymentMethod,
    undefined,
    session.discountAmount,
  );

  // CANCELLED でもリモートで支払済みなら確定する（古い URL 払いの回収）
  const claimed = await prisma.paymentSession.updateMany({
    where: {
      id: sessionId,
      status: { not: PaymentSessionStatus.PAID },
    },
    data: {
      status: PaymentSessionStatus.PAID,
      paymentMethod,
      paidAt: new Date(),
    },
  });

  const paidSession = await prisma.paymentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (claimed.count === 0 && paidSession.status !== PaymentSessionStatus.PAID) {
    throw new Error("決済セッションの更新に失敗しました");
  }

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
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.order.findFirst({
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
        const patch: { channel?: OrderChannel } = {};
        if (existing.channel !== OrderChannel.QR) patch.channel = OrderChannel.QR;
        // 人数はウェイター開始値を優先（QR開始で上書きしない）
        if (Object.keys(patch).length > 0) {
          await tx.order.update({
            where: { id: existing.id },
            data: patch,
          });
          return tx.order.findFirstOrThrow({
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
        return existing;
      }

      const table = await tx.table.findUniqueOrThrow({ where: { id: tableId } });
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const count = await tx.order.count({
        where: { storeId, createdAt: { gte: start } },
      });
      const d = new Date();
      const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      await tx.order.create({
        data: {
          storeId,
          tableId,
          orderNumber: `${prefix}-${String(count + 1).padStart(4, "0")}`,
          eatInType: table.eatInType,
          customerCount,
          channel: OrderChannel.QR,
          status: "OPEN",
        },
      });
      await tx.table.update({
        where: { id: tableId },
        data: { status: "OCCUPIED" },
      });

      return tx.order.findFirstOrThrow({
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
