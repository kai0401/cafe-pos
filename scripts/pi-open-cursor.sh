#!/usr/bin/env bash
# Cursor / VS Code でラズパイを直接開く
set -euo pipefail
bash "$(dirname "$0")/pi-update-ssh-host.sh" || true
if command -v cursor >/dev/null 2>&1; then
  cursor --folder-uri "vscode-remote://ssh-remote+azumaya-pos/opt/cafe-pos"
elif command -v code >/dev/null 2>&1; then
  code --folder-uri "vscode-remote://ssh-remote+azumaya-pos/opt/cafe-pos"
else
  echo "Cursor / VS Code の CLI がありません。"
  echo "Cursor で: Cmd+Shift+P → Remote-SSH: Connect to Host → azumaya-pos"
  echo "そのあとフォルダ /opt/cafe-pos を開いてください。"
fi
