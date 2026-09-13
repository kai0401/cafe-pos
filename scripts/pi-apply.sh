#!/usr/bin/env bash
# Remote-SSH で /opt/cafe-pos を編集したあと実行（Pi上）
# 使い方: bash scripts/pi-apply.sh
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
echo "build…"
npm run build
echo "restart…"
sudo systemctl restart cafe-pos-shop
sleep 3
curl -sS -m 10 http://127.0.0.1:3000/api/health
echo
