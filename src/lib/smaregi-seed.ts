import fs from "fs";
import path from "path";
import { ImportFileType } from "@prisma/client";
import { parseCsvBuffer } from "@/domain/import/csv-parser";
import { runImportJob } from "@/domain/import/import-service";
import { getDefaultStore, prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data", "smaregi");

const PRODUCT_CANDIDATES = ["商品.csv", "products.csv", "product.csv"];
const TRANSACTION_CANDIDATES = ["取引.csv", "transactions.csv", "transaction.csv"];

export type SmaregiCsvPaths = {
  productPath: string;
  transactionPath: string;
};

function findExistingFile(dir: string, candidates: string[]): string | null {
  for (const name of candidates) {
    const fullPath = path.join(dir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function resolveSmaregiCsvPaths(
  productPath?: string,
  transactionPath?: string,
): SmaregiCsvPaths | null {
  const resolvedProduct = productPath ?? findExistingFile(DATA_DIR, PRODUCT_CANDIDATES);
  const resolvedTransaction = transactionPath ?? findExistingFile(DATA_DIR, TRANSACTION_CANDIDATES);
  if (!resolvedProduct || !resolvedTransaction) return null;
  return { productPath: resolvedProduct, transactionPath: resolvedTransaction };
}

export async function importSmaregiCsvFiles(paths: SmaregiCsvPaths) {
  const store = await getDefaultStore();
  await prisma.store.update({
    where: { id: store.id },
    data: { name: "喫茶店" },
  });

  for (const [filePath, fileType] of [
    [paths.productPath, ImportFileType.PRODUCT_MASTER],
    [paths.transactionPath, ImportFileType.TRANSACTION_DETAIL],
  ] as const) {
    const buffer = fs.readFileSync(filePath);
    const parsed = parseCsvBuffer(buffer);
    const job = await prisma.smaregiImportJob.create({
      data: {
        storeId: store.id,
        sourceType: "CSV",
        fileType,
        fileName: path.basename(filePath),
        encoding: parsed.encoding,
        totalRows: parsed.rows.length,
      },
    });
    await runImportJob(job.id, fileType, parsed.rows);
  }

  const [productCount, txCount, total] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.salesTransaction.count({ where: { storeId: store.id } }),
    prisma.salesTransaction.aggregate({
      where: { storeId: store.id },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    storeId: store.id,
    productCount,
    transactionCount: txCount,
    totalAmount: total._sum.totalAmount ?? 0,
  };
}

export async function ensureSmaregiData(
  productPath?: string,
  transactionPath?: string,
): Promise<{ imported: boolean; summary?: Awaited<ReturnType<typeof importSmaregiCsvFiles>> }> {
  const store = await getDefaultStore();
  const existingProducts = await prisma.product.count({
    where: { storeId: store.id, dataSource: "SMAREGI" },
  });
  if (existingProducts > 0) {
    return { imported: false };
  }

  const paths = resolveSmaregiCsvPaths(productPath, transactionPath);
  if (!paths) {
    return { imported: false };
  }

  const summary = await importSmaregiCsvFiles(paths);
  return { imported: true, summary };
}
