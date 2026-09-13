#!/bin/bash
# Raspberry Pi（Raspberry Pi OS / Debian 系）に印刷エージェントを常駐登録する
# 使い方:
#   curl -fsSL <このファイルのURL> | sudo bash -s -- <クラウドURL> <PRINT_AGENT_KEY> <プリンターIP>
#   または、このディレクトリで: sudo bash print-agent-setup-linux.sh https://azumaya-pos.vercel.app <KEY> 192.168.1.230
set -euo pipefail

CLOUD_URL="${1:?クラウドURL（例 https://azumaya-pos.vercel.app）}"
AGENT_KEY="${2:?PRINT_AGENT_KEY}"
PRINTER_IP="${3:?プリンターIP（例 192.168.1.230）}"
PRINTER_PORT="${4:-9100}"

INSTALL_DIR=/opt/cafe-pos-print-agent
SERVICE=cafe-pos-print-agent

echo "1/4 Node.js を確認…"
if ! command -v node >/dev/null 2>&1 || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 20 ]; then
  echo "    Node.js 22 をインストールします"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "2/4 エージェントを配置…"
mkdir -p "$INSTALL_DIR/scripts"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SRC_DIR/print-agent.mjs" ]; then
  cp "$SRC_DIR/print-agent.mjs" "$INSTALL_DIR/scripts/print-agent.mjs"
else
  curl -fsSL "$CLOUD_URL/print-agent.mjs" -o "$INSTALL_DIR/scripts/print-agent.mjs"
fi
cat > "$INSTALL_DIR/.print-agent.json" <<EOF
{
  "url": "$CLOUD_URL",
  "key": "$AGENT_KEY",
  "printerIp": "$PRINTER_IP",
  "printerPort": $PRINTER_PORT
}
EOF
chmod 600 "$INSTALL_DIR/.print-agent.json"

echo "3/4 systemd サービスを登録…"
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Cafe POS Print Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$(command -v node) $INSTALL_DIR/scripts/print-agent.mjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now $SERVICE

echo "4/4 起動確認…"
sleep 3
systemctl --no-pager status $SERVICE | head -8
echo
echo "✅ 完了。ログ: journalctl -u $SERVICE -f"
echo "   テスト印刷はクラウドの管理画面 → プリンター設定 → テスト印刷 から"
