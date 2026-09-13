#!/usr/bin/env node
/**
 * 旧ローカル SQLite（prisma/dev.db）の実メニュー・店舗設定・テーブル構成を
 * 現行の PostgreSQL（DATABASE_URL）へ移行する一回きりのスクリプト。
 *
 * 使い方:
 *   DATABASE_URL="$(cat .tmp/test-database-url)" node scripts/migrate-menu-from-sqlite.mjs
 *
 * - カテゴリ: (storeId, name) で upsert
 * - 商品:     名前一致で update / なければ create
 * - テーブル: 名前一致で番号・区分・並び順を update（qrToken は既存を優先）
 * - 店舗設定: 店名・営業時間・定休日・インボイス番号を update
 * - 実メニューに存在しないデモ商品（OWN_POS）は HIDDEN に変更
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath = path.join(root, "prisma", "dev.db");

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("PostgreSQL 側に store がありません。先に /api/setup を実行してください。");

  const srcStore = sqlite.prepare("SELECT * FROM stores LIMIT 1").get();
  const srcCategories = sqlite.prepare("SELECT * FROM product_categories ORDER BY sort_order").all();
  const srcProducts = sqlite.prepare("SELECT * FROM products ORDER BY sort_order").all();
  const srcTables = sqlite.prepare("SELECT * FROM tables ORDER BY sort_order").all();

  // 店舗設定
  if (srcStore) {
    await prisma.store.update({
      where: { id: store.id },
      data: {
        name: srcStore.name,
        invoiceRegNumber: srcStore.invoice_reg_number,
        openTime: srcStore.open_time,
        closeTime: srcStore.close_time,
        regularClosedDays: JSON.parse(srcStore.regular_closed_days ?? "[3]"),
        timezone: srcStore.timezone ?? "Asia/Tokyo",
      },
    });
    console.log(`store: 設定を移行（${srcStore.name}）`);
  }

  // カテゴリ
  const categoryIdMap = new Map(); // 旧 category_id -> 新 category.id
  for (const c of srcCategories) {
    const cat = await prisma.productCategory.upsert({
      where: { storeId_name: { storeId: store.id, name: c.name } },
      create: {
        storeId: store.id,
        name: c.name,
        sortOrder: c.sort_order ?? 0,
        isActive: Boolean(c.is_active),
      },
      update: {
        sortOrder: c.sort_order ?? 0,
        isActive: Boolean(c.is_active),
      },
    });
    categoryIdMap.set(c.id, cat.id);
  }
  console.log(`categories: ${srcCategories.length} 件を upsert`);

  // 商品（名前一致で update / create）
  const existing = await prisma.product.findMany({ where: { storeId: store.id } });
  const byName = new Map(existing.map((p) => [p.name, p]));
  const realMenuNames = new Set(srcProducts.map((p) => p.name));
  let created = 0;
  let updated = 0;
  for (const p of srcProducts) {
    const data = {
      categoryId: p.category_id ? categoryIdMap.get(p.category_id) ?? null : null,
      priceDineIn: p.price_dine_in,
      priceTakeout: p.price_takeout,
      taxRate: p.tax_rate,
      status: p.status,
      sendToKitchen: Boolean(p.send_to_kitchen),
      smaregiDeptId: p.smaregi_dept_id,
      smaregiDeptName: p.smaregi_dept_name,
      costAmount: p.cost_amount,
      sortOrder: p.sort_order ?? 0,
      dataSource: p.data_source,
    };
    const found = byName.get(p.name);
    if (found) {
      await prisma.product.update({ where: { id: found.id }, data });
      updated++;
    } else {
      await prisma.product.create({ data: { ...data, storeId: store.id, name: p.name } });
      created++;
    }
  }
  console.log(`products: ${updated} 件更新 / ${created} 件追加`);

  // 実メニューにないデモ商品は非表示化（履歴保護のため削除しない）
  const hidden = await prisma.product.updateMany({
    where: {
      storeId: store.id,
      dataSource: "OWN_POS",
      name: { notIn: [...realMenuNames] },
      status: { not: "HIDDEN" },
    },
    data: { status: "HIDDEN" },
  });
  if (hidden.count > 0) console.log(`products: デモ商品 ${hidden.count} 件を非表示化`);

  // テーブル（名前一致・qrToken は既存優先）
  const pgTables = await prisma.table.findMany({ where: { storeId: store.id } });
  const tableByName = new Map(pgTables.map((t) => [t.name, t]));
  let tCreated = 0;
  let tUpdated = 0;
  for (const t of srcTables) {
    const found = tableByName.get(t.name);
    if (found) {
      await prisma.table.update({
        where: { id: found.id },
        data: {
          number: t.number,
          eatInType: t.eat_in_type,
          sortOrder: t.sort_order ?? 0,
          qrEnabled: Boolean(t.qr_enabled),
          qrToken: found.qrToken ?? t.qr_token,
        },
      });
      tUpdated++;
    } else {
      await prisma.table.create({
        data: {
          storeId: store.id,
          number: t.number,
          name: t.name,
          eatInType: t.eat_in_type,
          sortOrder: t.sort_order ?? 0,
          qrEnabled: Boolean(t.qr_enabled),
          qrToken: t.qr_token,
        },
      });
      tCreated++;
    }
  }
  console.log(`tables: ${tUpdated} 件更新 / ${tCreated} 件追加`);

  const activeCount = await prisma.product.count({
    where: { storeId: store.id, status: "ACTIVE" },
  });
  console.log(`完了: 現在の表示中商品 ${activeCount} 品`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
