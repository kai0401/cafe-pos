import { prisma } from "../src/lib/prisma";

async function main() {
  const [products, txs, items] = await Promise.all([
    prisma.product.count(),
    prisma.salesTransaction.count(),
    prisma.salesTransactionItem.count(),
  ]);
  console.log({ products, txs, items });
}

main().finally(() => prisma.$disconnect());
