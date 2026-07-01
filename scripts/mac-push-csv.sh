#!/bin/bash
# Macで1回実行: スマレジCSVをGitHubに送る
# 使い方: bash scripts/mac-push-csv.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PRODUCT="${1:-$ROOT/data/smaregi/商品.csv}"
TX="${2:-$ROOT/data/smaregi/取引.csv}"

if [[ ! -f "$PRODUCT" ]]; then
  echo "商品CSVが見つかりません: $PRODUCT"
  exit 1
fi
if [[ ! -f "$TX" ]]; then
  echo "取引CSVが見つかりません: $TX"
  exit 1
fi

mkdir -p data/smaregi
cp "$PRODUCT" data/smaregi/商品.csv
cp "$TX" data/smaregi/取引.csv

git add data/smaregi/商品.csv data/smaregi/取引.csv
git diff --cached --quiet && echo "変更なし" && exit 0

git commit -m "Add Smaregi CSV data for cloud import"
git push origin HEAD:csv-sync
echo "✅ GitHubの csv-sync ブランチに送信しました"
