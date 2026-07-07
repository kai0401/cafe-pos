#!/usr/bin/env node
/**
 * Vercel / Render 向けビルド（Linux 対応）
 * PostgreSQL スキーマ反映・クラウド初期データ投入
 */
import { execSync } from "child_process";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");

if (process.env.DATABASE_URL) {
  run("npx prisma db push --skip-generate");
  try {
    run("npx tsx scripts/cloud-init.ts");
  } catch {
    console.warn("vercel-build: cloud-init warning (DB may be unreachable at build time)");
  }
} else {
  console.warn("vercel-build: DATABASE_URL 未設定 — DB push をスキップ");
}

run("next build");
