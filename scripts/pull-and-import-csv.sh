#!/bin/bash
# クラウド側: csv-sync ブランチからCSVを取得してインポート
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git fetch origin csv-sync 2>/dev/null || { echo "csv-sync ブランチがありません"; exit 1; }
git checkout origin/csv-sync -- data/smaregi/商品.csv data/smaregi/取引.csv 2>/dev/null || {
  echo "CSVファイルが csv-sync にありません"
  exit 1
}

export DATABASE_URL="${DATABASE_URL:-postgresql://cafe:cafe@127.0.0.1:55432/cafe_pos?schema=public}"
npx tsx scripts/import-csv.ts
echo "✅ インポート完了"
