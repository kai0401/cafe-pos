/**
 * 開発用: スマレジCSVをCLIからインポート
 * npx tsx scripts/import-csv.ts <商品CSV> <取引CSV>
 */
import fs from "fs";
import { ImportFileType } from "@prisma/client";
import { parseCsvBuffer } from "../src/domain/import/csv-parser";
import { runImportJob } from "../src/domain/import/import-service";
import { getDefaultStore, prisma } from "../src/lib/prisma";

async function main() {
  const [productPath, txPath] = process.argv.slice(2);
  if (!productPath || !txPath) {
    console.error("Usage: npx tsx scripts/import-csv.ts <商品CSV> <取引CSV>");
    process.exit(1);
  }

  const store = await getDefaultStore();
  await prisma.store.update({
    where: { id: store.id },
    data: { name: "喫茶店" },
  });

  for (const [path, fileType] of [
    [productPath, ImportFileType.PRODUCT_MASTER],
    [txPath, ImportFileType.TRANSACTION_DETAIL],
  ] as const) {
    console.log(`Importing ${path}...`);
    const buffer = fs.readFileSync(path);
    const parsed = parseCsvBuffer(buffer);

    const job = await prisma.smaregiImportJob.create({
      data: {
        storeId: store.id,
        sourceType: "CSV",
        fileType,
        fileName: path.split("/").pop(),
        encoding: parsed.encoding,
        totalRows: parsed.rows.length,
      },
    });

    await runImportJob(job.id, fileType, parsed.rows);
    const done = await prisma.smaregiImportJob.findUnique({ where: { id: job.id } });
    console.log("Done:", done);
  }

  const txCount = await prisma.salesTransaction.count();
  const total = await prisma.salesTransaction.aggregate({ _sum: { totalAmount: true } });
  console.log(`\nTransactions: ${txCount}, Total: ¥${total._sum.totalAmount?.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
