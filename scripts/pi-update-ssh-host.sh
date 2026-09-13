#!/usr/bin/env bash
# mDNS / 現在のIPで ~/.ssh/config の Host azumaya-pos を更新
set -euo pipefail

CONFIG="$HOME/.ssh/config"
NAME="azumaya-pos"
USER_NAME="adumaya"

IP=""
# Try local hostname first
if ping -c 1 -W 2000 "${NAME}.local" >/dev/null 2>&1; then
  IP="$(dscacheutil -q host -a name "${NAME}.local" 2>/dev/null | awk '/ip_address:/{print $2; exit}')"
fi
if [ -z "$IP" ]; then
  IP="$(ping -c 1 -W 2000 "${NAME}.local" 2>/dev/null | sed -n 's/.*(\([0-9.]*\)).*/\1/p' | head -1)"
fi

if [ -z "$IP" ]; then
  echo "✗ ${NAME}.local が見つかりません。同じWi‑Fi／有線か確認してください。"
  exit 1
fi

echo "→ ${NAME}.local = $IP"

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
# trim trailing blank then append
while out and out[-1].strip() == "":
    out.pop()
out.append("\n" + block.lstrip("\n"))
p.write_text("".join(out))
print("updated ~/.ssh/config Host ${NAME} → ${IP}")
PY

ssh -o BatchMode=yes -o ConnectTimeout=5 "$NAME" "echo OK; hostname; hostname -I"
