#!/usr/bin/env bash
# Cursor / Mac からラズパイ店舗サーバーを操作する
# 使い方:
#   bash scripts/pi-remote.sh status|health|logs|restart|shell|deploy|backup|backup-pull|wifi-list
set -euo pipefail

HOST="${PI_SSH_HOST:-azumaya-pos}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

remote() {
  ssh -o ConnectTimeout=8 "$HOST" "$@"
}

cmd="${1:-status}"
shift || true

case "$cmd" in
  status)
    remote 'hostname; hostname -I; systemctl is-active cafe-pos-shop; systemctl is-active postgresql; curl -sS -m 5 http://127.0.0.1:3000/api/health; echo; ls -1t /opt/cafe-pos/backups/cafe_pos-*.sql.gz 2>/dev/null | head -3 || echo "(backup none yet)"'
    ;;
  health)
    remote 'curl -sS -m 5 http://127.0.0.1:3000/api/health; echo'
    ;;
  logs)
    remote "sudo journalctl -u cafe-pos-shop -n ${1:-80} --no-pager"
    ;;
  restart)
    remote 'sudo systemctl restart cafe-pos-shop && sleep 3 && curl -sS -m 8 http://127.0.0.1:3000/api/health; echo'
    ;;
  shell)
    exec ssh "$HOST"
    ;;
  deploy)
    # 営業時間外推奨。rsync → Piで build → restart
    # .env / printer-config / backups / embedded データは絶対に上書きしない
    rsync -az --delete \
      --exclude node_modules --exclude .next --exclude .tmp --exclude .git \
      --exclude .preview-logs --exclude backups --exclude .env --exclude .env.local \
      --exclude printer-config.json --exclude '*.dump.sql' \
      "$ROOT/" "${HOST}:/tmp/cafe-pos-sync/"
    remote 'sudo rsync -a --delete \
      --exclude node_modules --exclude .next --exclude .tmp --exclude backups \
      --exclude .env --exclude .env.local --exclude printer-config.json \
      /tmp/cafe-pos-sync/ /opt/cafe-pos/ && sudo chown -R adumaya:adumaya /opt/cafe-pos'
    # 本番はシステムPG :5432 を強制（Mac用 .env が混入しても戻す）
    remote 'grep -q "127.0.0.1:5432" /opt/cafe-pos/.env 2>/dev/null || printf "%s\n" "DATABASE_URL=\"postgresql://cafe:cafe@127.0.0.1:5432/cafe_pos?schema=public\"" "PORT=3000" "NODE_ENV=production" | sudo tee /opt/cafe-pos/.env >/dev/null; sudo chown adumaya:adumaya /opt/cafe-pos/.env; sudo chmod 600 /opt/cafe-pos/.env'
    remote 'cd /opt/cafe-pos && npm install && npm run build && sudo systemctl restart cafe-pos-shop'
    sleep 4
    remote 'curl -sS -m 10 http://127.0.0.1:3000/api/health; echo; grep DATABASE_URL /opt/cafe-pos/.env | sed "s/:cafe@/:***@/"'
    ;;
  backup)
    remote 'bash /opt/cafe-pos/scripts/pi-backup-db.sh'
    ;;
  backup-pull)
    mkdir -p "$ROOT/backups/from-pi"
    remote 'bash /opt/cafe-pos/scripts/pi-backup-db.sh' >/dev/null
    LATEST="$(remote 'ls -1t /opt/cafe-pos/backups/cafe_pos-*.sql.gz 2>/dev/null | head -1')"
    if [[ -z "${LATEST:-}" ]]; then
      echo "✗ Pi にバックアップがありません" >&2
      exit 1
    fi
    scp "${HOST}:${LATEST}" "$ROOT/backups/from-pi/"
    echo "✓ Macへ: $ROOT/backups/from-pi/$(basename "$LATEST")"
    ;;
  wifi-list)
    remote 'nmcli device wifi list 2>/dev/null || sudo iwlist wlan0 scan 2>/dev/null | head -40'
    ;;
  ip)
    remote 'hostname -I'
    ;;
  *)
    echo "使い方: $0 status|health|logs|restart|shell|deploy|backup|backup-pull|wifi-list|ip"
    exit 1
    ;;
esac
