#!/usr/bin/env node
/**
 * Vercel / Render 向けビルド（Linux 対応）
 * PostgreSQL スキーマ反映・クラウド初期データ投入
 *
 * 優先順位:
 * 1. prisma/migrations がある場合 → migrate deploy（本番向け）
 * 2. ない場合 → db push（現状の互換運用）
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");

if (process.env.DATABASE_URL) {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const hasMigrations =
    fs.existsSync(migrationsDir) &&
    fs.readdirSync(migrationsDir).some((name) => {
      const dir = path.join(migrationsDir, name);
      return (
        fs.statSync(dir).isDirectory() &&
        fs.existsSync(path.join(dir, "migration.sql"))
      );
    });

  if (hasMigrations) {
    run("npx prisma migrate deploy");
  } else {
    console.warn(
      "vercel-build: prisma/migrations 未作成 — db push で反映（将来 migrate へ移行推奨）",
    );
    run("npx prisma db push --skip-generate");
  }

  try {
    run("npx tsx scripts/cloud-init.ts");
  } catch {
    console.warn("vercel-build: cloud-init warning (DB may be unreachable at build time)");
  }
} else {
  console.warn("vercel-build: DATABASE_URL 未設定 — DB sync をスキップ");
}

run("next build");
