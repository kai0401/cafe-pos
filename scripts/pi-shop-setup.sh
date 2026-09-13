#!/usr/bin/env bash
# Raspberry Pi 上で店舗サーバーを常駐セットアップ
# 使い方（Piで）: sudo bash scripts/pi-shop-setup.sh
# 前提: このリポジトリ一式がカレント（pi-push 後の ~/cafe-pos-transfer）
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo で実行してください: sudo bash scripts/pi-shop-setup.sh"
  exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/opt/cafe-pos}"
SERVICE=cafe-pos-shop
APP_USER="${SUDO_USER:-pi}"
PG_PORT=5432
PRINTER_IP_DEFAULT=192.168.1.230

echo "=== Cafe POS ラズパイセットアップ ==="
echo "ソース: $SRC"
echo "配置先: $INSTALL_DIR"
echo "ユーザー: $APP_USER"
echo

echo "1/7 パッケージ…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates build-essential python3 rsync netcat-openbsd postgresql postgresql-client >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')" -lt 20 ]; then
  echo "    Node.js 22 をインストール…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "    node $(node -v) / npm $(npm -v)"

echo "2/7 アプリ配置…"
mkdir -p "$INSTALL_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .tmp \
  --exclude .git \
  --exclude .preview-logs \
  "$SRC/" "$INSTALL_DIR/"
mkdir -p "$INSTALL_DIR/.tmp" "$INSTALL_DIR/.preview-logs" "$INSTALL_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/printer-config.json" ]; then
  cat > "$INSTALL_DIR/printer-config.json" <<EOF
{
  "ip": "${PRINTER_IP:-$PRINTER_IP_DEFAULT}",
  "port": 9100,
  "printKitchenTicket": true,
  "printReceipt": true,
  "kickDrawer": true,
  "cols": 48,
  "storeName": "あづま家"
}
EOF
  chown "$APP_USER:$APP_USER" "$INSTALL_DIR/printer-config.json"
fi

# 店内用 .env（システム PostgreSQL）
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="postgresql://cafe:cafe@127.0.0.1:${PG_PORT}/cafe_pos?schema=public"
PORT=3000
NODE_ENV=production
EOF
chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env"
chmod 600 "$INSTALL_DIR/.env"

echo "3/7 npm install…"
sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && npm install"

echo "4/7 システム PostgreSQL・マイグレーション・データ投入…"
systemctl enable --now postgresql
# ロール/DB（既存ならスキップ）
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='cafe'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER cafe WITH PASSWORD 'cafe' SUPERUSER;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='cafe_pos'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE cafe_pos OWNER cafe;"

sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && npx prisma migrate deploy"
sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && npx prisma generate"

if [ -f "$INSTALL_DIR/pi-data.dump.sql" ]; then
  echo "    データ復元…"
  if ! command -v psql >/dev/null 2>&1; then
    apt-get install -y -qq postgresql-client >/dev/null
  fi
  psql "postgresql://cafe:cafe@127.0.0.1:${PG_PORT}/cafe_pos" \
    -v ON_ERROR_STOP=0 \
    -f "$INSTALL_DIR/pi-data.dump.sql" \
    > "$INSTALL_DIR/.preview-logs/pi-restore.log" 2>&1 || true
  echo "    restore log: $INSTALL_DIR/.preview-logs/pi-restore.log"
else
  echo "    ダンプなし → cloud-init（空なら店舗・卓を用意）"
  sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && npx tsx scripts/cloud-init.ts" || true
fi

echo "5/7 next build…"
sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && npm run build"

echo "6/7 systemd 登録…"
cat > /etc/systemd/system/${SERVICE}.service <<EOF
[Unit]
Description=Cafe POS Shop Server (Raspberry Pi)
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
Environment=PORT=3000
Environment=NODE_ENV=production
Environment=CAFE_POS_SYSTEM_PG=1
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-$INSTALL_DIR/.env
ExecStart=$(command -v node) $INSTALL_DIR/scripts/shop-server.mjs
Restart=always
RestartSec=3
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "7/7 起動確認…"
ok=0
for i in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:3000/api/health" 2>/dev/null | grep -q '"ok":true'; then
    ok=1
    break
  fi
  sleep 2
done

# 日次バックアップ cron
sudo -u "$APP_USER" bash -lc "cd '$INSTALL_DIR' && bash scripts/pi-install-backup-cron.sh" || true

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
if [ "$ok" = 1 ]; then
  curl -sS "http://127.0.0.1:3000/api/health" || true
  echo
  echo "✅ 完了"
else
  echo "⚠ ヘルス未確認。ログを見てください:"
  echo "   journalctl -u $SERVICE -n 80 --no-pager"
fi

echo
echo "スタッフ端末のURL:"
echo "  ウェイター  http://${IP:-ラズパイIP}:3000/waiter/tables"
echo "  キッチン    http://${IP:-ラズパイIP}:3000/kitchen"
echo "  管理        http://${IP:-ラズパイIP}:3000/admin/dashboard"
echo
echo "ログ: journalctl -u $SERVICE -f"
echo "再起動: systemctl restart $SERVICE"
echo "店入れ手順: GO-LIVE.md / OPS-STABLE.md"
