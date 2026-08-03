#!/usr/bin/env bash
# Deploy XinChat beside a running Qchat stack on the same VPS.
# Does NOT modify /root/qchat, qchat-api, or qchat nginx :80/:443.
#
# XinChat listens on:
#   API  127.0.0.1:8081  (systemd xinchat-api)
#   HTTPS :8443          (nginx xinchat-sidecar.conf)
#
# Usage (on the VPS as root):
#   ./deploy/deploy-sidecar.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QCHAT_ROOT="${QCHAT_ROOT:-/root/qchat}"
API_PORT="${XINCHAT_SIDE_API_PORT:-8081}"
HTTPS_PORT="${XINCHAT_SIDE_HTTPS_PORT:-8443}"

if [[ -x /usr/local/go/bin/go ]]; then
  export PATH="/usr/local/go/bin:$PATH"
fi
GO_BIN="$(command -v go || true)"
if [[ -z "$GO_BIN" ]]; then
  echo "error: go not found" >&2
  exit 1
fi

log() { printf '\n==> %s\n' "$*"; }

if [[ ! -d "$QCHAT_ROOT" ]]; then
  echo "warning: $QCHAT_ROOT not found (ok if Qchat lives elsewhere)" >&2
fi

# Refuse to clobber Qchat default site.
if [[ -L /etc/nginx/sites-enabled/xinchat.conf ]] || [[ -f /etc/nginx/sites-enabled/xinchat.conf ]]; then
  echo "error: /etc/nginx/sites-enabled/xinchat.conf exists ΓÇö that full config takes :443." >&2
  echo "       Remove it and use only xinchat-sidecar.conf for parallel deploy." >&2
  exit 1
fi

log "ensure TLS certs under deploy/certs/xinchat.*"
mkdir -p "$ROOT/deploy/certs"
if [[ ! -f "$ROOT/deploy/certs/xinchat.crt" ]]; then
  if [[ -f "$QCHAT_ROOT/deploy/certs/qchat.crt" ]]; then
    cp -a "$QCHAT_ROOT/deploy/certs/qchat.crt" "$ROOT/deploy/certs/xinchat.crt"
    cp -a "$QCHAT_ROOT/deploy/certs/qchat.key" "$ROOT/deploy/certs/xinchat.key"
    echo "copied TLS material from Qchat certs (same host IP)"
  else
    chmod +x "$ROOT/deploy/generate-tls.sh"
    "$ROOT/deploy/generate-tls.sh"
  fi
fi

log "create isolated Postgres role/db (inside existing postgres container)"
PG_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -n1 || true)"
if [[ -z "$PG_CONTAINER" ]]; then
  echo "error: no postgres container running" >&2
  exit 1
fi
PG_ADMIN_USER=qchat
if ! docker exec "$PG_CONTAINER" psql -U qchat -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  PG_ADMIN_USER=postgres
fi
docker exec -i "$PG_CONTAINER" psql -U "$PG_ADMIN_USER" -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'xinchat') THEN
    CREATE ROLE xinchat LOGIN PASSWORD 'xinchat';
  END IF;
END
$$;
SQL
if ! docker exec "$PG_CONTAINER" psql -U "$PG_ADMIN_USER" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='xinchat'" | grep -q 1; then
  docker exec -i "$PG_CONTAINER" psql -U "$PG_ADMIN_USER" -d postgres -c \
    "CREATE DATABASE xinchat OWNER xinchat;"
fi
echo "postgres role/db xinchat ready (container=$PG_CONTAINER)"

log "write deploy/xinchat-api.env if missing"
ENV_FILE="$ROOT/deploy/xinchat-api.env"
if [[ ! -f "$ENV_FILE" ]]; then
  JWT="$(openssl rand -hex 32)"
  cat >"$ENV_FILE" <<EOF
XINCHAT_HTTP_ADDR=:${API_PORT}
XINCHAT_DATABASE_URL=postgres://xinchat:xinchat@127.0.0.1:5432/xinchat?sslmode=disable
XINCHAT_REDIS_URL=redis://127.0.0.1:6379/2
XINCHAT_JWT_SECRET=${JWT}
XINCHAT_ENV=development
XINCHAT_CORS_ORIGIN=*
# Local disk blobs ΓÇö avoids sharing/clobbering Qchat MinIO buckets.
XINCHAT_OBJECT_STORAGE_URL=
XINCHAT_BUCKET=xinchat
XINCHAT_DATA_DIR=${ROOT}/services/api/data
EOF
  chmod 600 "$ENV_FILE"
  echo "wrote $ENV_FILE"
else
  # Ensure API port is the sidecar port.
  if grep -q '^XINCHAT_HTTP_ADDR=' "$ENV_FILE"; then
    sed -i "s|^XINCHAT_HTTP_ADDR=.*|XINCHAT_HTTP_ADDR=:${API_PORT}|" "$ENV_FILE"
  else
    echo "XINCHAT_HTTP_ADDR=:${API_PORT}" >>"$ENV_FILE"
  fi
fi

mkdir -p "$ROOT/services/api/data/uploads"

log "build API ΓåÆ bin/xinchat-api"
mkdir -p "$ROOT/services/api/bin"
(
  cd "$ROOT/services/api"
  go build -o bin/xinchat-api ./cmd/api
)

log "install/restart xinchat-api (port ${API_PORT})"
ln -sfn "$ROOT/deploy/xinchat-api.service" /etc/systemd/system/xinchat-api.service
# Drop-in override so we never depend on editing the unit for the sidecar port
# (env file already sets XINCHAT_HTTP_ADDR).
mkdir -p /etc/systemd/system/xinchat-api.service.d
cat >/etc/systemd/system/xinchat-api.service.d/sidecar.conf <<EOF
[Service]
EnvironmentFile=-${ROOT}/deploy/xinchat-api.env
EOF
systemctl daemon-reload
systemctl enable xinchat-api
systemctl restart xinchat-api

log "build web + admin static exports"
(
  cd "$ROOT/apps/web"
  npm ci
  NEXT_PUBLIC_API_URL="" npm run build
)
(
  cd "$ROOT/apps/admin"
  npm ci
  NEXT_PUBLIC_API_URL="" npm run build
)

log "enable nginx sidecar on :${HTTPS_PORT} (Qchat :443 untouched)"
ln -sfn "$ROOT/deploy/nginx-xinchat-sidecar.conf" /etc/nginx/sites-enabled/xinchat-sidecar.conf
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${HTTPS_PORT}/tcp" comment 'XinChat HTTPS sidecar' || true
fi
nginx -t
systemctl reload nginx

log "health checks"
curl -fsS --retry 5 --retry-delay 1 --retry-connrefused \
  "http://127.0.0.1:${API_PORT}/healthz" >/dev/null
echo "XinChat API  :${API_PORT}/healthz OK"
curl -kfsS --retry 3 --retry-delay 1 -o /dev/null "https://127.0.0.1:${HTTPS_PORT}/"
echo "XinChat Web  :${HTTPS_PORT}/ OK"
curl -kfsS --retry 3 --retry-delay 1 -o /dev/null "https://127.0.0.1:${HTTPS_PORT}/admin/"
echo "XinChat Admin :${HTTPS_PORT}/admin/ OK"

# Prove Qchat still up
if curl -fsS --retry 2 --retry-delay 1 "http://127.0.0.1:8080/healthz" >/dev/null 2>&1; then
  echo "Qchat API   :8080/healthz still OK"
fi
if curl -kfsS --retry 2 -o /dev/null https://127.0.0.1/ 2>/dev/null; then
  echo "Qchat Web   :443 still OK"
fi

log "sidecar deploy complete"
echo "Open https://$(hostname -I | awk '{print $1}'):${HTTPS_PORT}/"
echo "Admin https://$(hostname -I | awk '{print $1}'):${HTTPS_PORT}/admin/"
