#!/usr/bin/env bash
# Nightly Postgres backup via pg_dump.
#
# Dumps the database from the `db` container into a timestamped, gzipped file,
# verifies the dump is real, and prunes old ones.
#
# Schedule (cron inside WSL2 Ubuntu — see RUNBOOK_WSL2.md):
#   0 3 * * *  /home/msr/SpeedNet-SystemManagement/deploy/backup.sh
#
# NOTE ON .env: this deliberately reads only POSTGRES_USER / POSTGRES_DB out of
# .env instead of sourcing the whole file. Sourcing it would also import
# BACKUP_DIR=/code/backups — a path that only exists *inside* the backend
# container — and silently redirect host-side dumps into a directory that
# isn't the one anybody checks.
#
# Env (override as needed):
#   BACKUP_DIR       output directory         (default: /mnt/e/deploy/pgdumps)
#   RETENTION_DAYS   delete dumps older than  (default: 14)
set -euo pipefail

cd "$(dirname "$0")/.."

envval() { grep -oP "(?<=^$1=).*" .env 2>/dev/null | tr -d '\r' || true; }

DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/e/deploy/pgdumps}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PGUSER="$(envval POSTGRES_USER)"; PGUSER="${PGUSER:-speednet}"
PGDB="$(envval POSTGRES_DB)";     PGDB="${PGDB:-speednet}"
LOG="${LOG:-/mnt/e/deploy/logs/backup.log}"

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG")"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/speednet_${STAMP}.sql.gz"
TMP="$OUT.part"

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

notify() {
  local tok chat
  tok=$(envval ALERT_TELEGRAM_BOT_TOKEN)
  chat=$(envval ALERT_TELEGRAM_CHAT_ID)
  [ -n "${tok:-}" ] && [ -n "${chat:-}" ] || return 0
  curl -sS --max-time 10 -o /dev/null \
    -d "chat_id=$chat" --data-urlencode "text=$1" \
    "https://api.telegram.org/bot${tok}/sendMessage" || true
}

fail() {
  rm -f "$TMP"
  log "BACKUP FAILED: $1"
  notify "🚨 SPEEDNeT database backup FAILED: $1
No new dump was written to $BACKUP_DIR."
  exit 1
}

compose() {
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml "$@"
}

log "dumping $PGDB → $OUT"

# Write to .part first and only rename on success. Redirecting straight to the
# final name would leave a truncated file that looks like a valid backup if
# pg_dump died halfway — the worst possible failure for a backup system.
if ! compose exec -T "$DB_SERVICE" pg_dump -U "$PGUSER" "$PGDB" | gzip >"$TMP"; then
  fail "pg_dump/gzip returned non-zero"
fi

gzip -t "$TMP" 2>/dev/null || fail "dump is not valid gzip"

# A dump missing the core tables is a failure even if the pipe succeeded.
for tbl in towers links sectors ip_allocations users; do
  zgrep -q "CREATE TABLE public.$tbl" "$TMP" || fail "dump is missing table '$tbl'"
done

mv "$TMP" "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
log "backup complete ($SIZE)"

DELETED=$(find "$BACKUP_DIR" -name 'speednet_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && log "pruned $DELETED dump(s) older than ${RETENTION_DAYS}d"

exit 0
