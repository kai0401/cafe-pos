#!/bin/bash
# Macで1回実行: CSV または dev.db をクラウドに送る
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git pull origin main

HAS_CSV=0
HAS_DB=0
[[ -f data/smaregi/商品.csv && -f data/smaregi/取引.csv ]] && HAS_CSV=1
[[ -f prisma/dev.db ]] && HAS_DB=1

if [[ $HAS_CSV -eq 0 && $HAS_DB -eq 0 ]]; then
  echo "❌ data/smaregi/商品.csv+取引.csv も prisma/dev.db も見つかりません"
  exit 1
fi

git checkout -B data-sync main

if [[ $HAS_CSV -eq 1 ]]; then
  git add data/smaregi/商品.csv data/smaregi/取引.csv
  echo "📦 CSV を追加"
fi
if [[ $HAS_DB -eq 1 ]]; then
  COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM products;" 2>/dev/null || echo 0)
  if [[ "$COUNT" -gt 0 ]]; then
    git add prisma/dev.db
    echo "📦 dev.db を追加 (products=$COUNT)"
  fi
fi

git diff --cached --quiet && { echo "変更なし（すでに最新）"; exit 0; }
git commit -m "Sync Smaregi data for cloud import"
git push -f origin data-sync
echo "✅ data-sync ブランチに送信しました。クラウドで取り込みます。"
