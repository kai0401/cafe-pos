#!/usr/bin/env bash
# Pi 本番 .env をシステム PostgreSQL に固定（埋め込みPGに戻さない）
set -euo pipefail
ENV_FILE="${1:-/opt/cafe-pos/.env}"
cat > "$ENV_FILE" <<'EOF'
DATABASE_URL="postgresql://cafe:cafe@127.0.0.1:5432/cafe_pos?schema=public"
PORT=3000
NODE_ENV=production
EOF
chmod 600 "$ENV_FILE"
echo "✓ wrote $ENV_FILE (system PG :5432)"
