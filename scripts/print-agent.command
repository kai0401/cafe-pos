#!/bin/bash
# 印刷エージェント常駐ランチャー（Terminal 経由 → ローカルネットワーク権限でプリンターに接続可）
# このウィンドウは閉じないでください（最小化はOK）。閉じると伝票が出なくなります。
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
mkdir -p .preview-logs
printf '\033]0;Cafe POS 印刷エージェント（閉じない）\007'
echo "🖨 Cafe POS 印刷エージェント — このウィンドウは閉じないでください（最小化OK）"
while true; do
  node scripts/print-agent.mjs 2>&1 | tee -a .preview-logs/print-agent.log
  echo "[$(date '+%F %T')] print-agent 終了 → 5秒後に再起動" | tee -a .preview-logs/print-agent.log
  sleep 5
done
