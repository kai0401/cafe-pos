/**
 * 旧 Mac SQLite（prisma/dev.db）のスマレジ売上を、現行 PostgreSQL へ移行する。
 *
 * 使い方:
 *   export DATABASE_URL="$(cat .tmp/test-database-url)"
 *   npx tsx scripts/migrate-smaregi-from-sqlite.ts [path/to/dev.db]
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import {
  DataSource,
  EatInType,
  PaymentMethodType,
  TaxRate,
  TransactionType,
} from "@prisma/client";
import { aggregateSales } from "../src/domain/import/import-service";
import { getDefaultStore, prisma } from "../src/lib/prisma";

const sourcePath = path.resolve(process.argv[2] ?? "prisma/dev.db");

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // SQLite にミリ秒 Unix で入っている
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && /^\d+$/.test(value.trim())) {
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    return new Date(value);
  }
  throw new Error(`不正な日時: ${String(value)}`);
}

function toInt(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = String(value ?? "");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

type SrcTx = Record<string, unknown>;
type SrcItem = Record<string, unknown>;
type SrcPay = Record<string, unknown>;

async function main() {
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  console.log(`Source SQLite: ${sourcePath}`);

  const srcStore = db.prepare("SELECT id, name FROM stores LIMIT 1").get() as
    | { id: string; name: string }
    | undefined;
  if (!srcStore) throw new Error("SQLite に店舗がありません");

  const txCount = (
    db.prepare("SELECT COUNT(*) AS c FROM sales_transactions WHERE data_source = 'SMAREGI'").get() as {
      c: number;
    }
  ).c;
  console.log(`SMAREGI transactions in SQLite: ${txCount}`);
  if (txCount === 0) throw new Error("移行するスマレジ取引がありません");

  const store = await getDefaultStore();
  console.log(`Target store: ${store.name} (${store.id})`);

  // 現行 DB のスマレジ商品ID対応表
  const mappings = await prisma.externalProductMapping.findMany({
    where: { externalSource: "SMAREGI" },
    select: { externalProductId: true, productId: true },
  });
  const productByExternal = new Map(mappings.map((m) => [m.externalProductId, m.productId]));

  // 名前でもフォールバック（マッピング欠落時）
  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true },
  });
  const productByName = new Map<string, string>();
  for (const p of products) {
    if (!productByName.has(p.name)) productByName.set(p.name, p.id);
  }

  const transactions = db
    .prepare(
      `SELECT * FROM sales_transactions
       WHERE data_source = 'SMAREGI'
       ORDER BY transaction_at ASC`,
    )
    .all() as SrcTx[];

  let created = 0;
  let skipped = 0;
  let itemCount = 0;
  let paymentCount = 0;

  const BATCH = 100;
  for (let i = 0; i < transactions.length; i += BATCH) {
    const chunk = transactions.slice(i, i + BATCH);
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const externalId = String(row.external_id);
        const existing = await tx.salesTransaction.findUnique({
          where: {
            dataSource_externalId: { dataSource: DataSource.SMAREGI, externalId },
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const createdTx = await tx.salesTransaction.create({
          data: {
            storeId: store.id,
            externalId,
            dataSource: DataSource.SMAREGI,
            transactionType: asEnum(
              row.transaction_type,
              ["SALE", "REFUND", "VOID", "CANCEL"] as const,
              TransactionType.SALE,
            ),
            transactionAt: toDate(row.transaction_at),
            businessDate: toDate(row.business_date),
            subtotalAmount: toInt(row.subtotal_amount),
            discountAmount: toInt(row.discount_amount),
            totalAmount: toInt(row.total_amount),
            tax10Amount: toInt(row.tax_10_amount),
            tax8Amount: toInt(row.tax_8_amount),
            taxExemptAmount: toInt(row.tax_exempt_amount),
            consumptionTax10: toInt(row.consumption_tax_10),
            consumptionTax8: toInt(row.consumption_tax_8),
            consumptionTax: toInt(row.consumption_tax),
            customerCount: Math.max(1, toInt(row.customer_count, 1)),
            eatInType: asEnum(row.eat_in_type, ["DINE_IN", "TAKEOUT"] as const, EatInType.DINE_IN),
            staffName: row.staff_name ? String(row.staff_name) : null,
            tableNumber: row.table_number == null ? null : toInt(row.table_number),
            tableName: row.table_name ? String(row.table_name) : null,
            entryTime: row.entry_time ? toDate(row.entry_time) : null,
          },
        });
        created += 1;

        const items = db
          .prepare("SELECT * FROM sales_transaction_items WHERE sales_transaction_id = ?")
          .all(String(row.id)) as SrcItem[];

        for (const item of items) {
          const externalProductId = item.external_product_id
            ? String(item.external_product_id)
            : null;
          const productName = String(item.product_name);
          const productId =
            (externalProductId ? productByExternal.get(externalProductId) : undefined) ??
            productByName.get(productName) ??
            null;

          await tx.salesTransactionItem.create({
            data: {
              salesTransactionId: createdTx.id,
              externalDetailId: item.external_detail_id ? String(item.external_detail_id) : null,
              productId,
              externalProductId,
              productName,
              categoryId: item.category_id ? String(item.category_id) : null,
              categoryName: item.category_name ? String(item.category_name) : null,
              quantity: toInt(item.quantity, 1),
              unitPrice: toInt(item.unit_price),
              subtotalAmount: toInt(item.subtotal_amount),
              discountAmount: toInt(item.discount_amount),
              totalAmount: toInt(item.total_amount),
              taxRate: asEnum(
                item.tax_rate,
                ["STANDARD_10", "REDUCED_8", "EXEMPT"] as const,
                TaxRate.STANDARD_10,
              ),
              costAmount: item.cost_amount == null ? null : toInt(item.cost_amount),
            },
          });
          itemCount += 1;
        }

        const payments = db
          .prepare("SELECT * FROM sales_transaction_payments WHERE sales_transaction_id = ?")
          .all(String(row.id)) as SrcPay[];

        for (const pay of payments) {
          await tx.salesTransactionPayment.create({
            data: {
              salesTransactionId: createdTx.id,
              method: asEnum(
                pay.method,
                ["CASH", "CREDIT_CARD", "TRANSIT_IC", "QR", "STORES", "OTHER"] as const,
                PaymentMethodType.OTHER,
              ),
              amount: toInt(pay.amount),
            },
          });
          paymentCount += 1;
        }
      }
    });
    console.log(`… ${Math.min(i + BATCH, transactions.length)} / ${transactions.length}`);
  }

  console.log("Rebuilding SMAREGI aggregates…");
  await aggregateSales(store.id, DataSource.SMAREGI);

  const [sales, items, daily] = await Promise.all([
    prisma.salesTransaction.count({ where: { dataSource: DataSource.SMAREGI } }),
    prisma.salesTransactionItem.count({
      where: { salesTransaction: { dataSource: DataSource.SMAREGI } },
    }),
    prisma.salesDailySummary.count({ where: { dataSource: DataSource.SMAREGI } }),
  ]);

  console.log(
    JSON.stringify(
      {
        created,
        skipped,
        itemCount,
        paymentCount,
        target: { sales, items, daily },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
