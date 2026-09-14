#!/usr/bin/env bash
# Pi に cloudflared + cafe-pos-tunnel.service を入れる
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://azumaya-pos.vercel.app}"

echo "→ cloudflared を確認"
if ! command -v cloudflared >/dev/null 2>&1; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    aarch64|arm64) CF_ARCH=arm64 ;;
    x86_64|amd64) CF_ARCH=amd64 ;;
    *) echo "未対応アーキテクチャ: $ARCH"; exit 1 ;;
  esac
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/cloudflared" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
  chmod +x "$TMP/cloudflared"
  sudo mv "$TMP/cloudflared" /usr/local/bin/cloudflared
  rm -rf "$TMP"
fi
cloudflared --version | head -1

echo "→ PUBLIC_BASE_URL を .env に設定 ($PUBLIC_BASE_URL)"
if grep -q '^PUBLIC_BASE_URL=' "$ROOT/.env" 2>/dev/null; then
  sed -i.bak "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=\"$PUBLIC_BASE_URL\"|" "$ROOT/.env"
  rm -f "$ROOT/.env.bak"
else
  printf '\nPUBLIC_BASE_URL="%s"\n' "$PUBLIC_BASE_URL" >> "$ROOT/.env"
fi
chmod 600 "$ROOT/.env" || true

echo "→ systemd cafe-pos-tunnel"
sudo tee /etc/systemd/system/cafe-pos-tunnel.service >/dev/null <<EOF
[Unit]
Description=Cafe POS customer HTTPS tunnel (QR LTE)
After=network-online.target cafe-pos-shop.service
Wants=network-online.target
Requires=cafe-pos-shop.service

[Service]
Type=simple
User=adumaya
Group=adumaya
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=CLOUDFLARED_BIN=/usr/local/bin/cloudflared
EnvironmentFile=-$ROOT/.env
ExecStart=/usr/bin/node $ROOT/scripts/shop-tunnel.mjs
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cafe-pos-tunnel.service
sudo systemctl restart cafe-pos-tunnel.service
sleep 5
sudo systemctl is-active cafe-pos-tunnel.service
sudo systemctl is-active cafe-pos-shop.service
echo "→ remote url file:"
cat "$ROOT/.shop-remote-url.json" 2>/dev/null || echo "(まだ未作成 — 数秒待って再確認)"
echo "✓ tunnel install done"
