#!/usr/bin/env bash
# Restore XinChat from a backup directory produced by deploy/backup.sh.
#
# Usage:
#   ./deploy/restore.sh /path/to/backup-dir
#
# Safety:
#   Production DB restore requires XINCHAT_RESTORE_CONFIRM=YES
#   Isolated drill DB: XINCHAT_RESTORE_DB=xinchat_drill (no confirm needed)
#
# Env:
#   XINCHAT_RESTORE_CONFIRM=YES     Required to overwrite database `xinchat`
#   XINCHAT_RESTORE_DB=xinchat        Target database name (default xinchat)
#   XINCHAT_RESTORE_MINIO=1         Restore MinIO volume (default 1)
#   XINCHAT_RESTORE_UPLOADS=1       Restore local uploads (default 1)
#   XINCHAT_RESTORE_SECRETS=0       Restore env/certs from secrets bundle (default 0)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/deploy/backup-lib.sh"

SRC="${1:?usage: restore.sh /path/to/backup-dir}"
SRC="$(cd "$SRC" && pwd)"
TARGET_DB="${XINCHAT_RESTORE_DB:-xinchat}"

if [[ ! -d "$SRC" ]]; then
  echo "Not a directory: $SRC" >&2
  exit 1
fi

if [[ "$TARGET_DB" == "xinchat" && "${XINCHAT_RESTORE_CONFIRM:-}" != "YES" ]]; then
  echo "Refusing to overwrite production DB 'xinchat'." >&2
  echo "Re-run with XINCHAT_RESTORE_CONFIRM=YES, or set XINCHAT_RESTORE_DB=xinchat_drill for an isolated restore." >&2
  exit 2
fi

echo "==> Restore from $SRC → database=$TARGET_DB"

TMP_CLEANUP=()
cleanup() {
  local f
  for f in "${TMP_CLEANUP[@]:-}"; do
    [[ -n "$f" && -f "$f" && "$f" == *"/."* ]] && rm -f "$f" || true
  done
}
trap cleanup EXIT

materialize() {
  local name="$1" path
  if ! path="$(materialize_artifact "$SRC" "$name")"; then
    return 1
  fi
  if [[ "$path" != "$SRC/$name" && "$path" != "$SRC/${name}.enc" ]]; then
    TMP_CLEANUP+=("$path")
  fi
  echo "$path"
}

# --- Postgres ---
DUMP_PATH=""
if DUMP_PATH="$(materialize xinchat.dump)"; then
  echo "Restoring Postgres ($TARGET_DB)..."
  if [[ "$TARGET_DB" != "xinchat" ]]; then
    compose exec -T postgres \
      psql -U xinchat -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${TARGET_DB}' AND pid <> pg_backend_pid();" \
      >/dev/null 2>&1 || true
    compose exec -T postgres \
      psql -U xinchat -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
    compose exec -T postgres \
      psql -U xinchat -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${TARGET_DB} OWNER xinchat;"
  fi

  # pg_restore exits 1 on some benign notices; treat only exit >= 2 as hard fail,
  # but also require that tables exist afterwards.
  set +e
  compose exec -T postgres \
    pg_restore -U xinchat -d "$TARGET_DB" --clean --if-exists --no-owner < "$DUMP_PATH"
  RC=$?
  set -e
  if [[ "$RC" -ge 2 ]]; then
    echo "FAIL: pg_restore exit $RC" >&2
    exit 1
  fi
  TABLE_COUNT="$(compose exec -T postgres \
    psql -U xinchat -d "$TARGET_DB" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
    | tr -d '[:space:]')"
  if [[ -z "$TABLE_COUNT" || "$TABLE_COUNT" == "0" ]]; then
    echo "FAIL: restore produced zero public tables" >&2
    exit 1
  fi
  echo "  ok: postgres ($TABLE_COUNT public tables, pg_restore rc=$RC)"
else
  echo "FAIL: missing xinchat.dump(.enc)" >&2
  exit 1
fi

# --- MinIO ---
if [[ "${XINCHAT_RESTORE_MINIO:-1}" == "1" ]]; then
  if MINIO_TAR="$(materialize minio.tar.gz 2>/dev/null)"; then
    MINIO_VOL="$(minio_volume_name)"
    if [[ -z "$MINIO_VOL" ]]; then
      echo "FAIL: MinIO volume not found" >&2
      exit 1
    fi
    if [[ "$TARGET_DB" != "xinchat" ]]; then
      echo "  skip MinIO write (isolated DB restore; archive verified only)"
      tar tzf "$MINIO_TAR" >/dev/null
      echo "  ok: minio.tar.gz integrity"
    else
      echo "Restoring MinIO volume $MINIO_VOL..."
      # Stop API consumers ideally; wipe and extract.
      docker run --rm \
        -v "${MINIO_VOL}:/data" \
        -v "$(dirname "$MINIO_TAR"):/backup:ro" \
        alpine:3.20 \
        sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/$(basename "$MINIO_TAR") -C /data"
      echo "  ok: minio"
    fi
  else
    echo "  skip: no minio.tar.gz(.enc)"
  fi
fi

# --- Local uploads ---
if [[ "${XINCHAT_RESTORE_UPLOADS:-1}" == "1" ]]; then
  if UP_TAR="$(materialize uploads.tar.gz 2>/dev/null)"; then
    if [[ "$TARGET_DB" != "xinchat" ]]; then
      tar tzf "$UP_TAR" >/dev/null
      echo "  ok: uploads.tar.gz integrity (not extracted in drill mode)"
    else
      DATA_DIR="${XINCHAT_DATA_DIR:-$ROOT/services/api/data}"
      mkdir -p "$DATA_DIR"
      tar -C "$DATA_DIR" -xzf "$UP_TAR"
      echo "  ok: uploads extracted to $DATA_DIR"
    fi
  else
    echo "  skip: no uploads.tar.gz(.enc)"
  fi
fi

# --- Secrets ---
if [[ "${XINCHAT_RESTORE_SECRETS:-0}" == "1" ]]; then
  if SEC_TAR="$(materialize secrets.tar.gz 2>/dev/null)"; then
    if [[ "$TARGET_DB" != "xinchat" ]]; then
      tar tzf "$SEC_TAR" >/dev/null
      echo "  ok: secrets.tar.gz integrity"
    else
      tar -C "$ROOT/deploy" -xzf "$SEC_TAR" --strip-components=1
      echo "  ok: secrets restored under deploy/ (review env + certs)"
    fi
  else
    echo "  skip: no secrets bundle"
  fi
fi

echo "Restore complete (db=$TARGET_DB)."
if [[ "$TARGET_DB" == "xinchat" ]]; then
  echo "Validate: curl -fsS http://127.0.0.1:8080/healthz"
  echo "Restart API if needed: systemctl restart xinchat-api"
fi
