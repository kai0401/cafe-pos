#!/usr/bin/env bash
# mDNS / 引数IP / 環境変数で ~/.ssh/config の Host azumaya-pos を更新
# 使い方:
#   npm run pi:ssh-update
#   bash scripts/pi-update-ssh-host.sh 192.168.1.50
#   PI_HOST=192.168.1.50 npm run pi:ssh-update
set -euo pipefail

CONFIG="$HOME/.ssh/config"
NAME="azumaya-pos"
USER_NAME="adumaya"

IP="${1:-${PI_HOST:-}}"

if [ -z "$IP" ]; then
  if ping -c 1 -W 2000 "${NAME}.local" >/dev/null 2>&1; then
    IP="$(dscacheutil -q host -a name "${NAME}.local" 2>/dev/null | awk '/ip_address:/{print $2; exit}')"
  fi
  if [ -z "$IP" ]; then
    IP="$(ping -c 1 -W 2000 "${NAME}.local" 2>/dev/null | sed -n 's/.*(\([0-9.]*\)).*/\1/p' | head -1)"
  fi
fi

if [ -z "$IP" ]; then
  echo "✗ Pi のIPが分かりません。"
  echo "  ルーター管理画面で hostname「azumaya-pos」のIPを確認し:"
  echo "  bash scripts/pi-update-ssh-host.sh 192.168.x.x"
  exit 1
fi

echo "→ ${NAME} = $IP"

python3 - <<PY
from pathlib import Path
p = Path.home()/".ssh"/"config"
text = p.read_text() if p.exists() else ""
lines = text.splitlines(True)
out = []
skip = False
for line in lines:
    if line.startswith("Host ") and line.strip() == "Host ${NAME}":
        skip = True
        continue
    if skip and line.startswith("Host "):
        skip = False
    if skip:
        continue
    out.append(line)
block = """
# Cafe POS Raspberry Pi (Cursor Remote SSH / agent)
Host ${NAME}
  HostName ${IP}
  User ${USER_NAME}
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
"""
while out and out[-1].strip() == "":
    out.pop()
out.append("\n" + block.lstrip("\n"))
p.write_text("".join(out))
print("updated ~/.ssh/config Host ${NAME} → ${IP}")
PY

ssh -o BatchMode=yes -o ConnectTimeout=8 "$NAME" "echo OK; hostname; hostname -I; systemctl is-active cafe-pos-shop postgresql; curl -sS -m 5 http://127.0.0.1:3000/api/health; echo"
