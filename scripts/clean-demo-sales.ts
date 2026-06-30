/**
 * デモ用の仮売上データを削除
 * npx tsx scripts/clean-demo-sales.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const demoTxs = await prisma.salesTransaction.findMany({
    where: { externalId: { startsWith: "demo-" } },
    select: { id: true },
  });
  const ids = demoTxs.map((t) => t.id);
  if (ids.length === 0) {
    console.log("No demo transactions found.");
    return;
  }

  await prisma.salesTransaction.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${ids.length} demo transactions.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
