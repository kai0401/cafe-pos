import { DataSource, OrderItemStatus, OrderStatus, Prisma, TransactionType } from "@prisma/client";
import { aggregateSales } from "@/domain/import/import-service";
import { formatJSTToday, getBusinessDate } from "@/lib/datetime";
import { PAYMENT_LABELS } from "@/lib/format";
import { groupOrderItemsForDisplay } from "@/lib/order-modifiers";
import { buildClosingReport, sendToPrinter } from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { prisma } from "@/lib/prisma";

const OPEN_HISTORY_STATUSES: OrderStatus[] = [
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.READY,
];

function openOrderTotal(
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    status: string;
    note: string | null;
    createdAt: Date;
  }[],
) {
  return groupOrderItemsForDisplay(
    items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      status: i.status,
      note: i.note,
      createdAt: i.createdAt.toISOString(),
    })),
  ).reduce((s, i) => s + i.lineTotal, 0);
}

/** 未会計の注文（オーダー時点）を履歴集計用に返す */
export async function getOpenOrderHistoryRows(storeId: string) {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: OPEN_HISTORY_STATUSES },
      items: { some: { status: { not: OrderItemStatus.CANCELLED } } },
    },
    select: {
      createdAt: true,
      items: {
        where: { status: { not: OrderItemStatus.CANCELLED } },
        select: {
          id: true,
          productId: true,
          productName: true,
          unitPrice: true,
          quantity: true,
          status: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
  return orders.map((o) => ({
    createdAt: o.createdAt,
    totalAmount: openOrderTotal(o.items),
  }));
}

/**
 * 会計済み取引の取消（返金）。
 * 元取引は変更せず、負の金額の REFUND 取引を新規作成する（会計データの不変性）。
 */
export async function refundTransaction(transactionId: string, storeId: string) {
  const original = await prisma.salesTransaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { items: true, payments: true },
  });

  if (original.dataSource !== DataSource.OWN_POS) {
    throw new Error("スマレジ取込データは取消できません（スマレジ側で処理してください）");
  }
  if (original.transactionType !== TransactionType.SALE) {
    throw new Error("売上取引のみ取消できます");
  }

  const refundExternalId = `refund-${original.externalId}`;
  const existing = await prisma.salesTransaction.findUnique({
    where: {
      dataSource_externalId: { dataSource: DataSource.OWN_POS, externalId: refundExternalId },
    },
  });
  if (existing) {
    throw new Error("この取引はすでに取消済みです");
  }

  const refund = await prisma.salesTransaction.create({
    data: {
      storeId,
      externalId: refundExternalId,
      dataSource: DataSource.OWN_POS,
      transactionType: TransactionType.REFUND,
      transactionAt: new Date(),
      businessDate: getBusinessDate(new Date()),
      subtotalAmount: -original.subtotalAmount,
      discountAmount: -original.discountAmount,
      totalAmount: -original.totalAmount,
      tax10Amount: -original.tax10Amount,
      consumptionTax10: -original.consumptionTax10,
      consumptionTax: -original.consumptionTax,
      customerCount: 0,
      eatInType: original.eatInType,
      staffName: original.staffName,
      customerSegment: original.customerSegment,
      tableNumber: original.tableNumber,
      tableName: original.tableName,
      entryTime: original.entryTime,
    },
  });

  for (const item of original.items) {
    await prisma.salesTransactionItem.create({
      data: {
        salesTransactionId: refund.id,
        productId: item.productId,
        productName: item.productName,
        categoryName: item.categoryName,
        quantity: -item.quantity,
        unitPrice: item.unitPrice,
        subtotalAmount: -item.subtotalAmount,
        discountAmount: -item.discountAmount,
        totalAmount: -item.totalAmount,
        taxRate: item.taxRate,
      },
    });
  }

  for (const payment of original.payments) {
    await prisma.salesTransactionPayment.create({
      data: {
        salesTransactionId: refund.id,
        method: payment.method,
        amount: -payment.amount,
      },
    });
  }

  await aggregateSales(storeId, DataSource.OWN_POS);

  return refund;
}

/** 指定営業日の取引一覧（日別詳細画面用） */
export async function getTransactionsForDate(storeId: string, dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const transactions = await prisma.salesTransaction.findMany({
    where: { storeId, businessDate: date },
    include: { items: true, payments: true },
    orderBy: { transactionAt: "desc" },
  });

  const refundedIds = new Set(
    transactions
      .filter((t) => t.transactionType === TransactionType.REFUND)
      .map((t) => t.externalId.replace(/^refund-/, "")),
  );

  const paidRows = transactions.map((tx) => ({
    id: tx.id,
    externalId: tx.externalId,
    dataSource: tx.dataSource,
    transactionType: tx.transactionType,
    transactionAt: tx.transactionAt.toISOString(),
    entryTime: tx.entryTime?.toISOString() ?? null,
    totalAmount: tx.totalAmount,
    customerCount: tx.customerCount,
    tableNumber: tx.tableNumber,
    tableName: tx.tableName,
    staffName: tx.staffName,
    customerSegment: tx.customerSegment,
    payments: tx.payments.map((p) => ({ method: p.method, amount: p.amount })),
    items: tx.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      totalAmount: i.totalAmount,
    })),
    refunded: refundedIds.has(tx.externalId),
    canRefund:
      tx.dataSource === DataSource.OWN_POS &&
      tx.transactionType === TransactionType.SALE &&
      !refundedIds.has(tx.externalId),
    openOrder: false as const,
  }));

  const dayStart = new Date(`${dateStr}T00:00:00+09:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const isToday = dateStr === formatJSTToday();
  const openOrders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: OPEN_HISTORY_STATUSES },
      // 本日は現在の未会計すべて。過去日は当日開始の未会計のみ
      ...(isToday ? {} : { createdAt: { gte: dayStart, lt: dayEnd } }),
      items: { some: { status: { not: OrderItemStatus.CANCELLED } } },
    },
    include: {
      table: true,
      items: { where: { status: { not: OrderItemStatus.CANCELLED } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const openRows = openOrders.map((order) => {
    const displayItems = groupOrderItemsForDisplay(
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
    );
    return {
      id: order.id,
      externalId: `order-${order.orderNumber}`,
      dataSource: DataSource.OWN_POS,
      transactionType: "ORDER",
      transactionAt: order.createdAt.toISOString(),
      entryTime: order.createdAt.toISOString(),
      totalAmount: displayItems.reduce((s, i) => s + i.lineTotal, 0),
      customerCount: order.customerCount,
      tableNumber: order.table.number,
      tableName: order.table.name,
      staffName: order.staffName,
      customerSegment: order.customerSegment,
      payments: [] as { method: string; amount: number }[],
      items: displayItems.map((i) => ({
        name: i.displayName,
        quantity: i.quantity,
        totalAmount: i.lineTotal,
      })),
      refunded: false,
      canRefund: false,
      openOrder: true as const,
    };
  });

  return [...openRows, ...paidRows].sort((a, b) => b.transactionAt.localeCompare(a.transactionAt));
}

export type DailyClosingSummary = {
  businessDate: string;
  salesCount: number;
  salesTotal: number;
  refundCount: number;
  refundTotal: number;
  netTotal: number;
  discountTotal: number;
  taxTotal: number;
  customerCount: number;
  avgSpend: number;
  payments: { method: string; label: string; amount: number }[];
  openOrderCount: number;
  closedAt: string | null;
};

/** 本日（または指定営業日）の締めサマリー */
export async function getDailyClosing(storeId: string, dateStr?: string): Promise<DailyClosingSummary> {
  const businessDate = dateStr
    ? new Date(`${dateStr}T00:00:00.000Z`)
    : getBusinessDate(new Date());
  const dateKey = businessDate.toISOString().slice(0, 10);

  const transactions = await prisma.salesTransaction.findMany({
    where: { storeId, businessDate, dataSource: DataSource.OWN_POS },
    include: { payments: true },
  });

  const sales = transactions.filter((t) => t.transactionType === TransactionType.SALE);
  const refunds = transactions.filter((t) => t.transactionType === TransactionType.REFUND);

  const salesTotal = sales.reduce((s, t) => s + t.totalAmount, 0);
  const refundTotal = refunds.reduce((s, t) => s + t.totalAmount, 0);
  const netTotal = salesTotal + refundTotal;
  const customerCount = sales.reduce((s, t) => s + t.customerCount, 0);

  const paymentMap = new Map<string, number>();
  for (const tx of transactions) {
    for (const p of tx.payments) {
      paymentMap.set(p.method, (paymentMap.get(p.method) ?? 0) + p.amount);
    }
  }

  const openOrderCount = await prisma.order.count({
    where: { storeId, status: { in: ["OPEN", "SENT_TO_KITCHEN", "READY"] } },
  });

  const snapshot = await prisma.reportSnapshot.findFirst({
    where: { storeId, reportType: "DAILY_CLOSING", periodStart: businessDate },
    orderBy: { generatedAt: "desc" },
  });

  return {
    businessDate: dateKey,
    salesCount: sales.length,
    salesTotal,
    refundCount: refunds.length,
    refundTotal,
    netTotal,
    discountTotal: sales.reduce((s, t) => s + t.discountAmount, 0),
    taxTotal: transactions.reduce((s, t) => s + t.consumptionTax10, 0),
    customerCount,
    avgSpend: customerCount > 0 ? Math.round(netTotal / customerCount) : 0,
    payments: Array.from(paymentMap.entries()).map(([method, amount]) => ({
      method,
      label: PAYMENT_LABELS[method] ?? method,
      amount,
    })),
    openOrderCount,
    closedAt: snapshot?.generatedAt.toISOString() ?? null,
  };
}

/** レジ締め実行: スナップショット保存 + スマレジ互換CSV保管 + TM-m30 で締めレポート印刷 */
export async function executeDailyClosing(storeId: string) {
  const summary = await getDailyClosing(storeId);

  if (summary.openOrderCount > 0) {
    throw new Error(`未会計のテーブルが${summary.openOrderCount}件あります。先に会計または取消してください`);
  }

  const businessDate = new Date(`${summary.businessDate}T00:00:00.000Z`);
  await prisma.reportSnapshot.create({
    data: {
      storeId,
      reportType: "DAILY_CLOSING",
      periodStart: businessDate,
      periodEnd: businessDate,
      payload: summary as unknown as Prisma.InputJsonValue,
    },
  });

  let archiveDir: string | null = null;
  try {
    const { archiveSmaregiCsvFiles } = await import("@/domain/export/smaregi-archive");
    const archived = await archiveSmaregiCsvFiles({ storeId, businessDate });
    if (archived.ok && archived.dir) archiveDir = archived.dir;
  } catch (err) {
    console.error("[closing] スマレジCSV保管に失敗:", err instanceof Error ? err.message : err);
  }

  const config = loadPrinterConfig();
  let printed = false;
  if (config.ip) {
    try {
      await sendToPrinter(
        buildClosingReport(
          {
            storeName: config.storeName,
            businessDate: summary.businessDate,
            salesCount: summary.salesCount,
            salesTotal: summary.salesTotal,
            refundCount: summary.refundCount,
            refundTotal: summary.refundTotal,
            netTotal: summary.netTotal,
            customerCount: summary.customerCount,
            avgSpend: summary.avgSpend,
            payments: summary.payments,
            discountTotal: summary.discountTotal,
            taxTotal: summary.taxTotal,
          },
          config.cols,
        ),
        config,
        "closing",
      );
      printed = true;
    } catch (err) {
      console.error("[printer] 締めレポート印刷に失敗:", err instanceof Error ? err.message : err);
    }
  }

  return {
    ...summary,
    closedAt: new Date().toISOString(),
    printed,
    smaregiArchiveDir: archiveDir,
  };
}
