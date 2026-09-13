#!/usr/bin/env bash
# Mac側: pi-export の結果をラズパイへ送る
# 使い方:
#   PI_USER=pi PI_HOST=azumaya-pos.local bash scripts/pi-push.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.preview-logs/pi-transfer/app"
PI_USER="${PI_USER:?PI_USER を指定（例 pi）}"
PI_HOST="${PI_HOST:?PI_HOST を指定（例 azumaya-pos.local または IP）}"
DEST="${PI_DEST:-~/cafe-pos-transfer}"

if [ ! -d "$SRC" ]; then
  echo "先に bash scripts/pi-export-from-mac.sh を実行してください"
  exit 1
fi

echo "→ ${PI_USER}@${PI_HOST}:${DEST}"
ssh -o StrictHostKeyChecking=accept-new "${PI_USER}@${PI_HOST}" "mkdir -p ${DEST}"
rsync -az --delete -e ssh "$SRC/" "${PI_USER}@${PI_HOST}:${DEST}/"
echo "✅ 送信完了"
echo
echo "次に Pi で:"
echo "  ssh ${PI_USER}@${PI_HOST}"
echo "  cd ${DEST}"
echo "  sudo bash scripts/pi-shop-setup.sh"
