import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { prisma } from "../src/lib/prisma";

async function main() {
  await ensureWaiterSetup();
  const [products, transactions, tables] = await Promise.all([
    prisma.product.count(),
    prisma.salesTransaction.count(),
    prisma.table.count(),
  ]);
  console.log(`Seeded demo data: products=${products}, transactions=${transactions}, tables=${tables}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
