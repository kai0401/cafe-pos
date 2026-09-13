#!/bin/bash
# 店舗サーバー常駐ランチャー（Terminal 経由で起動 → ローカルネットワーク権限でプリンターに接続可）
# このウィンドウは閉じないでください（最小化はOK）。閉じるとサーバーが止まります。
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export PORT=3000
export NODE_ENV=production
mkdir -p .preview-logs
printf '\033]0;Cafe POS 店舗サーバー（閉じない）\007'
echo "🏪 Cafe POS 店舗サーバー — このウィンドウは閉じないでください（最小化OK）"
while true; do
  node scripts/shop-server.mjs 2>&1 | tee -a .preview-logs/shop-server.log
  echo "[$(date '+%F %T')] shop-server 終了 → 3秒後に再起動" | tee -a .preview-logs/shop-server.log
  sleep 3
done
