import {
  DataSource,
  PaymentMethodType,
  TransactionType,
} from "@prisma/client";
import { formatJST } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildMemo(tx: {
  tableNumber: number | null;
  tableName: string | null;
  customerCount: number;
  entryTime: Date | null;
  customerSegment: string | null;
}): string {
  const parts = ["Waiter"];
  if (tx.tableNumber != null) parts.push(`テーブル番号：${tx.tableNumber}`);
  if (tx.tableName) parts.push(`テーブル名：${tx.tableName}`);
  parts.push(`人数：${tx.customerCount}`);
  if (tx.entryTime) {
    parts.push(`入店時間：${formatJST(tx.entryTime, "yyyy-MM-dd HH:mm:ss")}`);
  }
  if (tx.customerSegment) parts.push(`客層：${tx.customerSegment}`);
  return parts.join(" ");
}

function paymentSplit(
  payments: { method: PaymentMethodType; amount: number }[],
  totalAmount: number,
) {
  let cash = 0;
  let credit = 0;
  for (const p of payments) {
    if (p.method === PaymentMethodType.CASH) cash += p.amount;
    else credit += p.amount; // クレジット / IC / QR / STORES はクレジット欄に寄せる
  }
  if (cash === 0 && credit === 0 && totalAmount !== 0) {
    cash = totalAmount;
  }
  return { cash, credit };
}

function transactionFlags(type: TransactionType): {
  headDivision: string;
  cancelFlag: string;
} {
  if (type === TransactionType.VOID) return { headDivision: "1", cancelFlag: "1" };
  if (type === TransactionType.CANCEL || type === TransactionType.REFUND) {
    return { headDivision: "2", cancelFlag: "0" };
  }
  return { headDivision: "1", cancelFlag: "0" };
}

/** スマレジ「取引明細CSV」互換（再取込可能な列セット） */
export const SMAREGI_TRANSACTION_HEADERS = [
  "取引ID",
  "取引明細ID",
  "取引日時",
  "取引区分",
  "取消区分",
  "合計",
  "小計",
  "内消費税",
  "内現金支払金額",
  "内クレジット支払金額",
  "スタッフ名",
  "メモ",
  "商品ID",
  "商品名",
  "部門ID",
  "部門名",
  "数量",
  "販売単価",
  "商品単価",
  "値引き前計",
  "単価値引き計",
  "値引き後計",
  "税区分",
  "原価",
] as const;

/** スマレジ「商品マスターCSV」互換 */
export const SMAREGI_PRODUCT_HEADERS = [
  "商品ID",
  "商品名",
  "商品単価",
  "原価",
  "部門ID",
  "税区分",
  "商品コード",
] as const;

export async function buildSmaregiTransactionCsv(params: {
  storeId: string;
  from: Date;
  to: Date;
  dataSource?: DataSource | "ALL";
}): Promise<string> {
  const sourceFilter =
    !params.dataSource || params.dataSource === "ALL"
      ? undefined
      : params.dataSource;

  const rows = await prisma.salesTransaction.findMany({
    where: {
      storeId: params.storeId,
      businessDate: { gte: params.from, lte: params.to },
      ...(sourceFilter ? { dataSource: sourceFilter } : {}),
    },
    orderBy: [{ transactionAt: "asc" }, { id: "asc" }],
    include: {
      items: {
        include: {
          product: {
            include: {
              category: true,
              externalMapping: {
                where: { externalSource: DataSource.SMAREGI },
                take: 1,
              },
            },
          },
        },
      },
      payments: true,
    },
  });

  const lines = [SMAREGI_TRANSACTION_HEADERS.join(",")];

  for (const tx of rows) {
    const { headDivision, cancelFlag } = transactionFlags(tx.transactionType);
    const { cash, credit } = paymentSplit(tx.payments, tx.totalAmount);
    const memo = buildMemo(tx);
    const datetime = formatJST(tx.transactionAt, "yyyy-MM-dd HH:mm:ss");
    const items = tx.items.length > 0 ? tx.items : [null];

    items.forEach((item, index) => {
      const mapping = item?.product?.externalMapping?.[0];
      const productId =
        mapping?.externalProductId ||
        item?.externalProductId ||
        item?.productId ||
        "";
      const deptId = item?.product?.smaregiDeptId || "";
      const deptName =
        item?.categoryName ||
        item?.product?.category?.name ||
        item?.product?.smaregiDeptName ||
        "";
      const unitPrice = item?.unitPrice ?? 0;
      const qty = item?.quantity ?? 0;
      const lineBefore = item?.subtotalAmount ?? unitPrice * qty;
      const lineDiscount = item?.discountAmount ?? 0;
      const lineAfter = item?.totalAmount ?? lineBefore - lineDiscount;
      const cost =
        item?.costAmount ??
        (item?.product?.costAmount != null
          ? item.product.costAmount * Math.abs(qty)
          : "");

      lines.push(
        [
          tx.externalId,
          item ? String(index + 1) : "1",
          datetime,
          headDivision,
          cancelFlag,
          tx.totalAmount,
          tx.subtotalAmount,
          tx.consumptionTax,
          cash,
          credit,
          tx.staffName ?? "",
          memo,
          productId,
          item?.productName ?? "",
          deptId,
          deptName,
          qty,
          unitPrice,
          unitPrice,
          lineBefore,
          lineDiscount,
          lineAfter,
          "10",
          cost,
        ]
          .map(csvEscape)
          .join(","),
      );
    });
  }

  return `\uFEFF${lines.join("\n")}`;
}

export async function buildSmaregiProductCsv(storeId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      externalMapping: {
        where: { externalSource: DataSource.SMAREGI },
        take: 1,
      },
    },
  });

  const lines = [SMAREGI_PRODUCT_HEADERS.join(",")];
  for (const p of products) {
    const mapping = p.externalMapping[0];
    lines.push(
      [
        mapping?.externalProductId || p.id,
        p.name,
        p.priceDineIn,
        p.costAmount ?? "",
        p.smaregiDeptId ?? "",
        "10",
        mapping?.externalProductCode ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return `\uFEFF${lines.join("\n")}`;
}
