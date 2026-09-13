#!/usr/bin/env bash
# Mac側: ラズパイへ送るパッケージを作る（ソース + DBダンプ）
# 使い方: bash scripts/pi-export-from-mac.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.preview-logs/pi-transfer"
export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"

mkdir -p "$OUT"
rm -rf "$OUT"/*
mkdir -p "$OUT/app"

echo "1/3 ソースをコピー（node_modules / .next は除外）…"
rsync -a \
  --exclude node_modules \
  --exclude .next \
  --exclude .next-staging \
  --exclude .next-prev \
  --exclude .tmp \
  --exclude .git \
  --exclude .preview-logs \
  --exclude backups \
  --exclude '.env*.local' \
  "$ROOT/" "$OUT/app/"

# プリンター設定は含める
if [ -f "$ROOT/printer-config.json" ]; then
  cp "$ROOT/printer-config.json" "$OUT/app/printer-config.json"
fi

echo "2/3 DBをダンプ…"
DUMP="$OUT/app/pi-data.dump.sql"
dump_one() {
  local url="$1"
  local label="$2"
  local clean
  clean="$(node -e '
const u=new URL(process.argv[1]);
u.searchParams.delete("schema");
u.searchParams.delete("pgbouncer");
u.searchParams.delete("connect_timeout");
process.stdout.write(u.toString());
' "$url")"
  echo "    ← $label"
  pg_dump --no-owner --no-acl --data-only --exclude-table=_prisma_migrations "$clean" -f "$DUMP"
}

if [ -f "$ROOT/.preview-logs/neon-direct.url" ]; then
  dump_one "$(cat "$ROOT/.preview-logs/neon-direct.url")" "Neon（クラウド＝本番データ）"
elif [ -f "$ROOT/.env" ]; then
  LOCAL="$(node -e '
const fs=require("fs");
const t=fs.readFileSync(".env","utf8");
const m=t.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if(!m) process.exit(1);
process.stdout.write(m[1]);
' )"
  dump_one "$LOCAL" "ローカル .env"
else
  echo "⚠ DBダンプをスキップ（.env / neon-direct.url なし）"
  DUMP=""
fi

if [ -n "${DUMP:-}" ] && [ -f "$DUMP" ]; then
  # pg_dump 18 の \restrict 行は psql 古いと困るので除去
  if grep -q '^\\restrict' "$DUMP" 2>/dev/null; then
    grep -v '^\\restrict\|^\\unrestrict' "$DUMP" > "$DUMP.clean"
    mv "$DUMP.clean" "$DUMP"
  fi
  wc -c "$DUMP" | awk '{print "    dump",$1,"bytes"}'
fi

echo "3/3 完了"
cat > "$OUT/README.txt" <<EOF
このフォルダを Pi に送り、Pi 上で:

  cd ~/cafe-pos-transfer
  sudo bash scripts/pi-shop-setup.sh

Mac から送る例:

  bash scripts/pi-push.sh
EOF

echo
echo "✅ 出力: $OUT"
echo "   次: PI_USER=… PI_HOST=… bash scripts/pi-push.sh"
