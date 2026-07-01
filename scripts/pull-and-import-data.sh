#!/bin/bash
# クラウド側: data-sync ブランチからデータを取得してインポート
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git fetch origin data-sync 2>/dev/null; then
  echo "❌ data-sync ブランチがありません。Macで bash scripts/mac-push-data.sh を実行してください"
  exit 1
fi

git checkout origin/data-sync -- data/smaregi/商品.csv data/smaregi/取引.csv 2>/dev/null || true
git checkout origin/data-sync -- prisma/dev.db 2>/dev/null || true

export DATABASE_URL="${DATABASE_URL:-postgresql://cafe:cafe@127.0.0.1:55432/cafe_pos?schema=public}"

if [[ -f data/smaregi/商品.csv && -f data/smaregi/取引.csv ]]; then
  echo "📥 CSVからインポート..."
  npx tsx scripts/import-csv.ts
elif [[ -f prisma/dev.db ]]; then
  echo "📥 dev.dbからインポート..."
  npx tsx scripts/import-from-sqlite.ts prisma/dev.db
else
  echo "❌ data-sync に CSV も dev.db もありません"
  exit 1
fi

echo "✅ インポート完了"
