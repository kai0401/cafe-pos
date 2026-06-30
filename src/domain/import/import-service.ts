import {
  DataSource,
  EatInType,
  ImportFileType,
  ImportJobStatus,
  PaymentMethodType,
  Prisma,
  TaxRate,
  TransactionType,
} from "@prisma/client";
import { getBusinessDate, getHourJST, parseSmaregiDateTime } from "@/lib/datetime";
import { parseYen } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getColumn, parseSmaregiMemo } from "./smaregi-mapper";

import { categorySortOrder, resolveCategoryName } from "@/lib/smaregi-categories";

function mapTaxRate(_taxCode: string): TaxRate {
  return TaxRate.STANDARD_10;
}

function mapTransactionType(headDivision: string, cancelFlag: string): TransactionType {
  if (cancelFlag === "1") return TransactionType.VOID;
  if (headDivision === "2" || headDivision === "3") return TransactionType.CANCEL;
  return TransactionType.SALE;
}

export async function importProductMaster(
  storeId: string,
  jobId: string,
  rows: Record<string, string>[],
): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const externalId = getColumn(row, "商品ID");
      if (!externalId) {
        skipped++;
        continue;
      }

      const deptId = getColumn(row, "部門ID");
      const categoryName = resolveCategoryName(deptId, getColumn(row, "商品名"));
      let category = await prisma.productCategory.findUnique({
        where: { storeId_name: { storeId, name: categoryName } },
      });
      if (!category) {
        category = await prisma.productCategory.create({
          data: { storeId, name: categoryName, sortOrder: categorySortOrder(categoryName) },
        });
      }

      const name = getColumn(row, "商品名");
      const price = parseYen(getColumn(row, "商品単価"));
      const cost = parseYen(getColumn(row, "原価")) || null;

      const existingMapping = await prisma.externalProductMapping.findUnique({
        where: {
          externalSource_externalProductId: {
            externalSource: DataSource.SMAREGI,
            externalProductId: externalId,
          },
        },
        include: { product: true },
      });

      if (existingMapping) {
        await prisma.product.update({
          where: { id: existingMapping.productId },
          data: {
            name,
            priceDineIn: price,
            costAmount: cost,
            categoryId: category.id,
            smaregiDeptId: deptId,
          },
        });
        skipped++;
        continue;
      }

      const product = await prisma.product.create({
        data: {
          storeId,
          categoryId: category.id,
          name,
          priceDineIn: price,
          costAmount: cost,
          taxRate: mapTaxRate(getColumn(row, "税区分")),
          dataSource: DataSource.SMAREGI,
          smaregiDeptId: deptId,
        },
      });

      await prisma.externalProductMapping.create({
        data: {
          productId: product.id,
          externalProductId: externalId,
          externalProductCode: getColumn(row, "商品コード") || null,
          externalProductName: name,
        },
      });

      success++;
    } catch (error) {
      failed++;
      await prisma.smaregiImportError.create({
        data: {
          importJobId: jobId,
          rowNumber: i + 2,
          rawPayload: row as unknown as Prisma.InputJsonValue,
          errorCode: "PRODUCT_IMPORT_ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  return { success, failed, skipped };
}

export async function importTransactionDetails(
  storeId: string,
  jobId: string,
  rows: Record<string, string>[],
): Promise<{
  success: number;
  failed: number;
  skipped: number;
  totalAmount: number;
  transactionCount: number;
}> {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let totalAmount = 0;

  const transactions = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const txId = getColumn(row, "取引ID");
    if (!txId) continue;
    if (!transactions.has(txId)) transactions.set(txId, []);
    transactions.get(txId)!.push(row);
  }

  for (const [txId, txRows] of transactions) {
    try {
      const existing = await prisma.salesTransaction.findUnique({
        where: {
          dataSource_externalId: {
            dataSource: DataSource.SMAREGI,
            externalId: txId,
          },
        },
      });

      if (existing) {
        skipped += txRows.length;
        continue;
      }

      const header = txRows[0]!;
      const headDivision = getColumn(header, "取引区分");
      const cancelFlag = getColumn(header, "取消区分");
      const transactionType = mapTransactionType(
        headDivision.replace(/[^0-9].*/, "") || headDivision.charAt(0),
        cancelFlag.charAt(0),
      );

      const transactionAt = parseSmaregiDateTime(getColumn(header, "取引日時"));
      const businessDate = getBusinessDate(transactionAt);
      const memo = parseSmaregiMemo(getColumn(header, "メモ"));

      const total = parseYen(getColumn(header, "合計"));
      const subtotal = parseYen(getColumn(header, "小計"));
      const consumptionTax = parseYen(getColumn(header, "内消費税"));
      const cashAmount = parseYen(getColumn(header, "内現金支払金額"));
      const creditAmount = parseYen(getColumn(header, "内クレジット支払金額"));
      const staffName = getColumn(header, "スタッフ名") || null;

      const salesTx = await prisma.salesTransaction.create({
        data: {
          storeId,
          externalId: txId,
          dataSource: DataSource.SMAREGI,
          transactionType,
          transactionAt,
          businessDate,
          subtotalAmount: subtotal || total,
          totalAmount: total,
          consumptionTax,
          consumptionTax10: consumptionTax,
          customerCount: memo.guestCount ?? 1,
          eatInType: EatInType.DINE_IN,
          staffName,
          tableNumber: memo.tableNumber ?? null,
          tableName: memo.tableName ?? null,
          entryTime: memo.entryTime ?? null,
          importJobId: jobId,
        },
      });

      totalAmount += total;

      const payments: { method: PaymentMethodType; amount: number }[] = [];
      if (cashAmount > 0) payments.push({ method: PaymentMethodType.CASH, amount: cashAmount });
      if (creditAmount > 0) payments.push({ method: PaymentMethodType.CREDIT_CARD, amount: creditAmount });
      if (payments.length === 0 && total > 0) {
        payments.push({ method: PaymentMethodType.CASH, amount: total });
      }

      for (const p of payments) {
        await prisma.salesTransactionPayment.create({
          data: {
            salesTransactionId: salesTx.id,
            method: p.method,
            amount: p.amount,
          },
        });
      }

      for (let i = 0; i < txRows.length; i++) {
        const row = txRows[i]!;
        const detailId = getColumn(row, "取引明細ID");
        const productName = getColumn(row, "商品名");
        const quantity = parseInt(getColumn(row, "数量") || "0", 10);
        const lineTotal = parseYen(getColumn(row, "値引き後計"));

        if (!detailId && !productName && lineTotal === 0) continue;

        const externalProductId = getColumn(row, "商品ID") || null;
        const deptName = getColumn(row, "部門名") || null;
        const isTakeout = productName.includes("テイクアウト");

        let productId: string | null = null;
        if (externalProductId) {
          const mapping = await prisma.externalProductMapping.findUnique({
            where: {
              externalSource_externalProductId: {
                externalSource: DataSource.SMAREGI,
                externalProductId,
              },
            },
          });
          productId = mapping?.productId ?? null;

          if (!mapping && productName) {
            const categoryName = resolveCategoryName(getColumn(row, "部門ID"), productName);
            let category = await prisma.productCategory.findUnique({
              where: { storeId_name: { storeId, name: categoryName } },
            });
            if (!category) {
              category = await prisma.productCategory.create({
                data: { storeId, name: categoryName },
              });
            }
            const newProduct = await prisma.product.create({
              data: {
                storeId,
                categoryId: category.id,
                name: productName,
                priceDineIn: parseYen(getColumn(row, "販売単価") || getColumn(row, "商品単価")),
                costAmount: parseYen(getColumn(row, "原価")) || null,
                dataSource: DataSource.SMAREGI,
              },
            });
            await prisma.externalProductMapping.create({
              data: {
                productId: newProduct.id,
                externalProductId,
                externalProductName: productName,
              },
            });
            productId = newProduct.id;
          }
        }

        const detailKey = detailId ? `${txId}-${detailId}` : `${txId}-${i}`;

        await prisma.smaregiRawTransactionDetail.create({
          data: {
            importJobId: jobId,
            smaregiTransactionId: txId,
            smaregiDetailId: detailKey,
            rawPayload: row as unknown as Prisma.InputJsonValue,
            sourceRowNumber: i + 1,
          },
        });

        if (productName && quantity > 0) {
          await prisma.salesTransactionItem.create({
            data: {
              salesTransactionId: salesTx.id,
              externalDetailId: detailKey,
              productId,
              externalProductId,
              productName,
              categoryName: deptName,
              quantity,
              unitPrice: parseYen(getColumn(row, "販売単価") || getColumn(row, "商品単価")),
              subtotalAmount: parseYen(getColumn(row, "値引き前計")) || lineTotal,
              discountAmount: parseYen(getColumn(row, "単価値引き計")),
              totalAmount: lineTotal,
              taxRate: mapTaxRate(getColumn(row, "税区分")),
              costAmount: parseYen(getColumn(row, "原価")) || null,
            },
          });

          if (isTakeout) {
            await prisma.salesTransaction.update({
              where: { id: salesTx.id },
              data: { eatInType: EatInType.TAKEOUT },
            });
          }
        }

        success++;
      }
    } catch (error) {
      failed += txRows.length;
      await prisma.smaregiImportError.create({
        data: {
          importJobId: jobId,
          rowNumber: 0,
          rawPayload: { transactionId: txId } as Prisma.InputJsonValue,
          errorCode: "TX_IMPORT_ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  return {
    success,
    failed,
    skipped,
    totalAmount,
    transactionCount: transactions.size,
  };
}

export async function runImportJob(
  jobId: string,
  fileType: ImportFileType,
  rows: Record<string, string>[],
): Promise<void> {
  const job = await prisma.smaregiImportJob.findUniqueOrThrow({ where: { id: jobId } });

  await prisma.smaregiImportJob.update({
    where: { id: jobId },
    data: { status: ImportJobStatus.IMPORTING, startedAt: new Date(), totalRows: rows.length },
  });

  let result: Record<string, number> = {};

  if (fileType === ImportFileType.PRODUCT_MASTER) {
    result = await importProductMaster(job.storeId, jobId, rows);
  } else if (fileType === ImportFileType.TRANSACTION_DETAIL) {
    const txResult = await importTransactionDetails(job.storeId, jobId, rows);
    result = txResult;
    await aggregateSales(job.storeId, DataSource.SMAREGI);
  }

  await prisma.smaregiImportJob.update({
    where: { id: jobId },
    data: {
      status: ImportJobStatus.COMPLETED,
      completedAt: new Date(),
      successRows: result.success ?? 0,
      failedRows: result.failed ?? 0,
      skippedRows: result.skipped ?? 0,
      resultSummary: result as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function aggregateSales(storeId: string, dataSource: DataSource): Promise<void> {
  const transactions = await prisma.salesTransaction.findMany({
    where: { storeId, dataSource, transactionType: TransactionType.SALE },
    include: { items: true, payments: true },
  });

  const dailyMap = new Map<string, {
    netSales: number;
    customerCount: number;
    orderCount: number;
    itemCount: number;
    dineIn: number;
    takeout: number;
  }>();

  const hourlyMap = new Map<string, { netSales: number; customerCount: number; orderCount: number }>();
  const paymentMap = new Map<string, number>();
  const productMap = new Map<string, { name: string; category: string | null; qty: number; sales: number }>();

  for (const tx of transactions) {
    const dateKey = tx.businessDate.toISOString().slice(0, 10);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { netSales: 0, customerCount: 0, orderCount: 0, itemCount: 0, dineIn: 0, takeout: 0 });
    }
    const daily = dailyMap.get(dateKey)!;
    daily.netSales += tx.totalAmount;
    daily.customerCount += tx.customerCount;
    daily.orderCount += 1;
    daily.itemCount += tx.items.reduce((s, i) => s + i.quantity, 0);
    if (tx.eatInType === EatInType.TAKEOUT) daily.takeout += tx.totalAmount;
    else daily.dineIn += tx.totalAmount;

    const hour = getHourJST(tx.transactionAt);
    const hourKey = `${dateKey}|${hour}`;
    if (!hourlyMap.has(hourKey)) {
      hourlyMap.set(hourKey, { netSales: 0, customerCount: 0, orderCount: 0 });
    }
    const hourly = hourlyMap.get(hourKey)!;
    hourly.netSales += tx.totalAmount;
    hourly.customerCount += tx.customerCount;
    hourly.orderCount += 1;

    for (const p of tx.payments) {
      const payKey = `${dateKey}-${p.method}`;
      paymentMap.set(payKey, (paymentMap.get(payKey) ?? 0) + p.amount);
    }

    for (const item of tx.items) {
      const prodKey = item.productName;
      if (!productMap.has(prodKey)) {
        productMap.set(prodKey, { name: item.productName, category: item.categoryName, qty: 0, sales: 0 });
      }
      const prod = productMap.get(prodKey)!;
      prod.qty += item.quantity;
      prod.sales += item.totalAmount;
    }
  }

  await prisma.salesDailySummary.deleteMany({ where: { storeId, dataSource } });
  await prisma.salesHourlySummary.deleteMany({ where: { storeId, dataSource } });
  await prisma.salesPaymentSummary.deleteMany({ where: { storeId, dataSource } });
  await prisma.salesProductSummary.deleteMany({ where: { storeId, dataSource } });

  for (const [dateKey, data] of dailyMap) {
    await prisma.salesDailySummary.create({
      data: {
        storeId,
        businessDate: new Date(dateKey),
        dataSource,
        grossSales: data.netSales,
        netSales: data.netSales,
        customerCount: data.customerCount,
        orderCount: data.orderCount,
        itemCount: data.itemCount,
        avgSpend: data.customerCount > 0 ? Math.round(data.netSales / data.customerCount) : 0,
        dineInSales: data.dineIn,
        takeoutSales: data.takeout,
      },
    });
  }

  for (const [hourKey, data] of hourlyMap) {
    const [dateKey, hourStr] = hourKey.split("|");
    await prisma.salesHourlySummary.create({
      data: {
        storeId,
        businessDate: new Date(dateKey!),
        hour: parseInt(hourStr!, 10),
        dataSource,
        netSales: data.netSales,
        customerCount: data.customerCount,
        orderCount: data.orderCount,
      },
    });
  }

  for (const [payKey, amount] of paymentMap) {
    const parts = payKey.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    if (!parts) continue;
    await prisma.salesPaymentSummary.create({
      data: {
        storeId,
        businessDate: new Date(parts[1]!),
        method: parts[2] as PaymentMethodType,
        dataSource,
        amount,
      },
    });
  }

  if (transactions.length > 0) {
    const dates = transactions.map((t) => t.businessDate);
    const periodStart = new Date(Math.min(...dates.map((d) => d.getTime())));
    const periodEnd = new Date(Math.max(...dates.map((d) => d.getTime())));

    for (const [, data] of productMap) {
      await prisma.salesProductSummary.create({
        data: {
          storeId,
          productName: data.name,
          categoryName: data.category,
          periodStart,
          periodEnd,
          dataSource,
          quantity: data.qty,
          grossSales: data.sales,
          netSales: data.sales,
        },
      });
    }
  }
}

export function buildPreviewSummary(
  fileType: ImportFileType,
  rows: Record<string, string>[],
): Record<string, unknown> {
  if (fileType === ImportFileType.PRODUCT_MASTER) {
    return {
      rowCount: rows.length,
      sampleProducts: rows.slice(0, 5).map((r) => ({
        id: getColumn(r, "商品ID"),
        name: getColumn(r, "商品名"),
        price: parseYen(getColumn(r, "商品単価")),
      })),
    };
  }

  const txIds = new Set(rows.map((r) => getColumn(r, "取引ID")).filter(Boolean));
  let totalAmount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const txId = getColumn(row, "取引ID");
    if (txId && !seen.has(txId)) {
      seen.add(txId);
      totalAmount += parseYen(getColumn(row, "合計"));
    }
  }

  return {
    rowCount: rows.length,
    transactionCount: txIds.size,
    totalAmount,
    dateRange: {
      from: rows.reduce((min, r) => {
        const d = getColumn(r, "取引日時");
        return d && d < min ? d : min;
      }, "9999"),
      to: rows.reduce((max, r) => {
        const d = getColumn(r, "取引日時");
        return d && d > max ? d : max;
      }, ""),
    },
  };
}
