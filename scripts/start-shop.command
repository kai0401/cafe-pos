#!/bin/bash
# 店舗POS起動（Terminal経由 = プリンターLAN接続可）
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export PORT=3000

# 埋め込みDB
if ! nc -z 127.0.0.1 55432 >/dev/null 2>&1; then
  /usr/local/bin/node scripts/start-embedded-pg.mjs >/dev/null 2>&1 &
  sleep 2
fi

# 既に起動中なら何もしない
if curl -sf "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
  echo "すでに起動中: http://192.168.1.249:3000/waiter/tables"
  exit 0
fi

echo "店舗サーバー起動中…"
echo "スタッフ用（固定）: http://192.168.1.249:3000/waiter/tables"
exec npx next start -H 0.0.0.0 -p 3000
