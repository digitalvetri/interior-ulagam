#!/bin/sh
# Nightly backup: a compressed Postgres dump plus a mirror of object storage.
# Runs inside the `backup` container, which has both pg_dump and mc available.
set -eu

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=/backups
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "[backup] starting $STAMP"

# ── Postgres ────────────────────────────────────────────────────────────────
# --clean --if-exists so the dump can be restored over an existing database.
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --host=postgres --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$DEST/postgres-$STAMP.sql.gz"

SIZE=$(wc -c < "$DEST/postgres-$STAMP.sql.gz")
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] FAILED: dump is only ${SIZE} bytes — refusing to keep it"
  rm -f "$DEST/postgres-$STAMP.sql.gz"
  exit 1
fi
echo "[backup] postgres ok (${SIZE} bytes)"

# ── Object storage ──────────────────────────────────────────────────────────
mc alias set backupsrc "http://minio:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mirror --overwrite --remove backupsrc/documents "$DEST/minio/documents" >/dev/null
mc mirror --overwrite --remove backupsrc/quotes    "$DEST/minio/quotes"    >/dev/null
echo "[backup] object storage mirrored"

# ── Retention ───────────────────────────────────────────────────────────────
find "$DEST" -maxdepth 1 -name 'postgres-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete
echo "[backup] done $STAMP (keeping ${RETENTION_DAYS} days)"
