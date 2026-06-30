import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { removeDemoMenu } from "../src/lib/demo-seed";
import { ensureSmaregiData } from "../src/lib/smaregi-seed";
import { prisma } from "../src/lib/prisma";

async function main() {
  const store = await prisma.store.findFirst();
  if (store) {
    const removed = await removeDemoMenu(store.id);
    if (removed > 0) {
      console.log(`Removed ${removed} placeholder menu items`);
    }
  }

  const { imported, summary } = await ensureSmaregiData();
  if (!imported) {
    console.error(
      "スマレジCSVが見つかりません。data/smaregi/ に 商品.csv と 取引.csv を置いてから再実行してください。",
    );
    process.exit(1);
  }

  await ensureWaiterSetup();

  const [products, transactions, tables] = await Promise.all([
    prisma.product.count(),
    prisma.salesTransaction.count(),
    prisma.table.count(),
  ]);

  console.log(
    `Imported Smaregi data: products=${summary?.productCount ?? products}, transactions=${summary?.transactionCount ?? transactions}, total=¥${(summary?.totalAmount ?? 0).toLocaleString()}, tables=${tables}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
