#!/usr/bin/env node
/**
 * クラウド本番デプロイ手順を表示
 * 使い方: node scripts/deploy-cloud.mjs
 */
import { execSync } from "child_process";

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Cafe POS — クラウド本番（店舗PC不要）                        ║
╚══════════════════════════════════════════════════════════════╝

【1】Neon で PostgreSQL を作成
    https://neon.tech → プロジェクト作成 → 接続文字列をコピー

【2】Vercel にデプロイ
    GitHub: github.com/kai0401/cafe-pos
    環境変数（必須）:
      DATABASE_URL     = postgresql://...（Neon）
      PUBLIC_BASE_URL  = https://あなたのアプリ.vercel.app
      ADMIN_PIN        = 管理画面PIN（4桁以上推奨）
      STAFF_PIN        = ウェイターPIN

    任意:
      STORES_API_KEY   = QRからのオンライン決済
      OPENAI_API_KEY   = レシートAI分類

【3】デプロイ後の初期設定
    1. https://<your-app>.vercel.app/admin/login でログイン
    2. /admin/imports でスマレジ商品CSVをインポート
    3. /admin/settings で店舗名・STORES決済を設定
    4. /admin/qr でQRシールを印刷 → テーブルに貼付

【4】スタッフ端末（Mac不要）
    iPhone:  /waiter/tables  → ホーム画面に追加
    iPad:    /kitchen        → ホーム画面に追加（常時表示）

【5】動作確認
    npm run rollout:check   （ローカルから本番DBを指す場合）

詳細: ROLLOUT.md
`);

try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const remote = execSync("git remote get-url origin 2>/dev/null", { encoding: "utf8" }).trim();
  console.log(`現在のブランチ: ${branch}`);
  console.log(`リモート: ${remote}`);
  console.log("\nmain ブランチに push すると GitHub Actions が Vercel へ自動デプロイします。\n");
} catch {
  // ignore
}
