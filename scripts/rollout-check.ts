import fs from "fs";
import path from "path";
import { isCloudRuntime, isPrinterSupported } from "../src/lib/runtime-config";
import { prisma } from "../src/lib/prisma";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
}

function warn(name: string, detail: string) {
  checks.push({ name, ok: true, detail: `⚠ ${detail}` });
}

async function main() {
  const cloud = isCloudRuntime();
  pass("運用モード", cloud ? "クラウド（店舗 Mac 不要）" : "ローカル開発");

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    fail("DATABASE_URL", "未設定");
  } else if (cloud && !dbUrl.startsWith("postgresql")) {
    fail("DATABASE_URL", "クラウド本番は PostgreSQL（Neon）が必要です");
  } else if (!cloud && dbUrl.startsWith("file:")) {
    pass("DATABASE_URL", `SQLite（ローカル開発）: ${dbUrl}`);
  } else if (dbUrl.startsWith("postgresql")) {
    pass("DATABASE_URL", "PostgreSQL（本番向け）");
  } else {
    pass("DATABASE_URL", "設定済み");
  }

  const publicUrl = process.env.PUBLIC_BASE_URL?.trim() || process.env.VERCEL_URL;
  if (cloud && publicUrl) {
    pass("PUBLIC_BASE_URL", publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`);
  } else if (cloud) {
    fail("PUBLIC_BASE_URL", "QRシール用の固定URLが未設定です");
  } else {
    warn("PUBLIC_BASE_URL", "ローカル開発では任意");
  }

  pass("ログイン", "廃止（PIN 認証なし）");

  try {
    await prisma.$connect();
    pass("DB接続", "成功");
  } catch (e) {
    fail("DB接続", String(e));
    printReport();
    process.exit(1);
  }

  const [products, tables, transactions] = await Promise.all([
    prisma.product.count(),
    prisma.table.count(),
    prisma.salesTransaction.count(),
  ]);

  if (products > 0) pass("商品マスタ", `${products} 件`);
  else fail("商品マスタ", "0 件。CSV を /admin/imports からインポート");

  if (tables >= 9) pass("テーブル", `${tables} 席`);
  else fail("テーブル", `${tables} 席。npm run db:seed を実行`);

  if (transactions > 0) pass("売上データ", `${transactions} 件`);
  else warn("売上データ", "0 件。CSV インポートを検討");

  const tablesWithQr = await prisma.table.count({ where: { qrToken: { not: null } } });
  if (tablesWithQr >= 9) pass("QRトークン", `${tablesWithQr} テーブル`);
  else warn("QRトークン", "npm run db:seed でトークンを生成");

  if (isPrinterSupported()) {
    const printerPath = path.join(process.cwd(), "printer-config.json");
    if (fs.existsSync(printerPath)) {
      pass("プリンター", "ローカルモード（TM-m30 設定可）");
    } else {
      warn("プリンター", "printer-config.json なし（ローカル開発のみ）");
    }
  } else {
    pass("キッチン伝票", "画面表示モード（クラウド）。/kitchen を iPad で常時表示");
    pass("レシート印刷", "STORES決済端末を使用");
  }

  if (cloud) {
    pass("レシート画像", "PostgreSQL 保存（クラウド対応）");
  } else {
    const uploadsDir = path.join(process.cwd(), "uploads", "receipts");
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      pass("レシート画像", `ローカル: ${uploadsDir}`);
    } catch {
      fail("レシート画像", "書き込み不可");
    }
  }

  printReport();
  const hasFail = checks.some((c) => !c.ok);
  process.exit(hasFail ? 1 : 0);
}

function printReport() {
  console.log("\n=== 導入前チェック ===\n");
  for (const c of checks) {
    const icon = c.ok ? (c.detail.startsWith("⚠") ? "⚠" : "✓") : "✗";
    console.log(`${icon} ${c.name}: ${c.detail}`);
  }
  const fails = checks.filter((c) => !c.ok).length;
  const warns = checks.filter((c) => c.ok && c.detail.startsWith("⚠")).length;
  console.log(`\n結果: ${fails} 失敗 / ${warns} 警告 / ${checks.length} 項目`);
  if (fails === 0) console.log("\n導入準備 OK。ROLLOUT.md を参照してください。\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
