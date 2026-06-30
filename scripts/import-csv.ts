/**
 * 開発用: スマレジCSVをCLIからインポート
 * npx tsx scripts/import-csv.ts <商品CSV> <取引CSV>
 */
import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { importSmaregiCsvFiles, resolveSmaregiCsvPaths } from "../src/lib/smaregi-seed";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [productPath, txPath] = process.argv.slice(2);
  const paths = resolveSmaregiCsvPaths(productPath, txPath);
  if (!paths) {
    console.error("Usage: npx tsx scripts/import-csv.ts <商品CSV> <取引CSV>");
    console.error("Or place files in data/smaregi/ as 商品.csv and 取引.csv");
    process.exit(1);
  }

  console.log(`Importing ${paths.productPath} and ${paths.transactionPath}...`);
  const summary = await importSmaregiCsvFiles(paths);
  await ensureWaiterSetup();

  console.log(
    `\nProducts: ${summary.productCount}, Transactions: ${summary.transactionCount}, Total: ¥${summary.totalAmount.toLocaleString()}`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
