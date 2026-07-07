#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
DATE="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# .env から SQLite パスを取得（file:./prisma/dev.db 形式）
ENV_FILE="$ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ .env がありません" >&2
  exit 1
fi

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
if [[ "$DB_URL" != file:* ]]; then
  echo "⚠ SQLite 以外の DATABASE_URL です。PostgreSQL は Neon/Render のバックアップ機能を使ってください。" >&2
  exit 0
fi

REL_PATH="${DB_URL#file:}"
DB_PATH="$ROOT/$REL_PATH"

if [[ ! -f "$DB_PATH" ]]; then
  echo "✗ DB ファイルが見つかりません: $DB_PATH" >&2
  exit 1
fi

DEST="$BACKUP_DIR/dev-$DATE.db"
cp "$DB_PATH" "$DEST"
echo "✓ バックアップ完了: $DEST"

# 30日より古いバックアップを削除
find "$BACKUP_DIR" -name "dev-*.db" -mtime +30 -delete 2>/dev/null || true
