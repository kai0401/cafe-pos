import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { ensureDemoData, removeDemoMenu } from "../src/lib/demo-seed";
import { ensureSmaregiData, resolveSmaregiCsvPaths } from "../src/lib/smaregi-seed";
import { prisma } from "../src/lib/prisma";

async function main() {
  const store = await prisma.store.findFirst();
  const csvPaths = resolveSmaregiCsvPaths();

  if (csvPaths) {
    if (store) {
      const removed = await removeDemoMenu(store.id);
      if (removed > 0) {
        console.log(`Removed ${removed} placeholder menu items`);
      }
    }

    const { imported, summary } = await ensureSmaregiData();
    if (!imported) {
      console.log("Smaregi products already imported — skipped CSV import");
    } else {
      console.log(
        `Imported Smaregi data: products=${summary?.productCount}, transactions=${summary?.transactionCount}, total=¥${(summary?.totalAmount ?? 0).toLocaleString()}`,
      );
    }
  } else {
    console.warn(
      "スマレジCSVが見つかりません。プレビュー用のフォールバックデータを使用します。",
    );
    console.warn("本番メニュー・売上を使う場合は data/smaregi/ に 商品.csv と 取引.csv を置いて再実行してください。");
    const targetStore = store ?? (await prisma.store.findFirst());
    if (targetStore) {
      await ensureDemoData(targetStore.id);
    }
  }

  await ensureWaiterSetup();

  const [products, transactions, tables] = await Promise.all([
    prisma.product.count(),
    prisma.salesTransaction.count(),
    prisma.table.count(),
  ]);

  console.log(`Seed complete: products=${products}, transactions=${transactions}, tables=${tables}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
