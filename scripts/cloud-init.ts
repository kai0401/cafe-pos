/**
 * クラウド本番の初期セットアップ（Vercel ビルド時・手動実行）
 * - 店舗・テーブル・QRトークン・カテゴリを作成
 * - デモ売上データは投入しない
 */
import { ensureWaiterSetup } from "../src/lib/waiter-setup";
import { isCloudRuntime } from "../src/lib/runtime-config";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("cloud-init: DATABASE_URL 未設定 — スキップ");
    return;
  }

  const store = await ensureWaiterSetup();
  const [products, tables, withQr] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.table.count({ where: { storeId: store.id } }),
    prisma.table.count({ where: { storeId: store.id, qrToken: { not: null } } }),
  ]);

  console.log(
    `cloud-init: ${isCloudRuntime() ? "クラウド" : "DB"} — 店舗=${store.name} 商品=${products} テーブル=${tables} QR=${withQr}`,
  );

  if (products === 0) {
    console.log("cloud-init: 商品未登録 → /admin/imports でCSVをインポートしてください");
  }
}

main()
  .catch((e) => {
    console.error("cloud-init failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
