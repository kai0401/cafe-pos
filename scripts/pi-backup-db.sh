#!/usr/bin/env bash
# Pi上の PostgreSQL を pg_dump。毎日 cron からも呼ぶ。
# 使い方（Pi）: bash scripts/pi-backup-db.sh
# 使い方（Mac）: npm run pi:backup
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DATE="$(date +%Y%m%d-%H%M%S)"
ENV_FILE="$ROOT/.env"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ .env がありません: $ENV_FILE" >&2
  exit 1
fi

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
if [[ "$DB_URL" != postgresql* ]]; then
  echo "✗ PostgreSQL の DATABASE_URL が必要です" >&2
  exit 1
fi

# Prisma 用 ?schema=public などは pg_dump が拒否するので除去
DUMP_URL="${DB_URL%%\?*}"
PORT_HINT="$(echo "$DUMP_URL" | sed -n 's/.*:\([0-9][0-9]*\)\/.*/\1/p')"
PORT_HINT="${PORT_HINT:-5432}"

# システムPG(:5432)=17 / 埋め込み(:55432)は別系統。メジャー一致の pg_dump を使う
PG_DUMP=pg_dump
if [[ "$PORT_HINT" == "5432" && -x /usr/lib/postgresql/17/bin/pg_dump ]]; then
  PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump
elif [[ -x /usr/lib/postgresql/18/bin/pg_dump ]]; then
  PG_DUMP=/usr/lib/postgresql/18/bin/pg_dump
elif [[ -x /usr/lib/postgresql/17/bin/pg_dump ]]; then
  PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump
fi

DEST="$BACKUP_DIR/cafe_pos-$DATE.sql.gz"
echo "dump → $DEST ($PG_DUMP @ :$PORT_HINT)"
if ! "$PG_DUMP" "$DUMP_URL" --no-owner --no-acl | gzip -c > "$DEST"; then
  rm -f "$DEST"
  echo "✗ pg_dump 失敗" >&2
  exit 1
fi
SIZE=$(wc -c < "$DEST" | tr -d ' ')
if [[ "$SIZE" -lt 200 ]]; then
  rm -f "$DEST"
  echo "✗ ダンプが小さすぎます（失敗の可能性）" >&2
  exit 1
fi
ls -lh "$DEST"

find "$BACKUP_DIR" -name 'cafe_pos-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
echo "✓ 完了（${KEEP_DAYS}日より古い分は削除）"
