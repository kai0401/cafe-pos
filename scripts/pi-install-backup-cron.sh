#!/usr/bin/env bash
# 日次バックアップ用 cron を Pi に入れる（idempotent）
# 使い方（Pi）: bash scripts/pi-install-backup-cron.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/pi-backup-db.sh"
LOG="$ROOT/.preview-logs/backup-cron.log"
mkdir -p "$ROOT/.preview-logs"
chmod +x "$SCRIPT"

LINE="15 3 * * * $SCRIPT >> $LOG 2>&1"
# 既存の同スクリプト行を除いて追加
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'pi-backup-db.sh' > "$TMP" || true
echo "$LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "✓ cron 登録:"
crontab -l | grep pi-backup-db || true
echo "ログ: $LOG"
