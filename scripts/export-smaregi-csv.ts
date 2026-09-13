/**
 * スマレジ互換CSVを backups/smaregi/YYYY-MM-DD/ に書き出す
 * usage:
 *   npx tsx scripts/export-smaregi-csv.ts
 *   npx tsx scripts/export-smaregi-csv.ts 2026-09-12
 */
import { getBusinessDate, parseExpenseDate } from "../src/lib/datetime";
import { getDefaultStore, prisma } from "../src/lib/prisma";
import { archiveSmaregiCsvFiles } from "../src/domain/export/smaregi-archive";

async function main() {
  const arg = process.argv[2];
  const day = arg ? parseExpenseDate(arg) : getBusinessDate(new Date());
  const store = await getDefaultStore();
  const result = await archiveSmaregiCsvFiles({ storeId: store.id, businessDate: day });
  if (!result.ok) {
    console.error("archive skipped:", result.skipped ?? "unknown");
    process.exit(1);
  }
  console.log("SMAREGI_CSV_ARCHIVED", result.dir);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
