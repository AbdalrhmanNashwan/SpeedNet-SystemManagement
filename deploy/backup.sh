#!/usr/bin/env bash
# Nightly Postgres backup via pg_dump.
#
# Dumps the database from the `db` container into a timestamped, gzipped file
# and prunes backups older than RETENTION_DAYS.
#
# Schedule with cron on the host, e.g.:
#   0 3 * * *  /opt/speednet/deploy/backup.sh >> /var/log/speednet-backup.log 2>&1
#
# Env (override as needed):
#   COMPOSE_FILE     compose file(s) to use   (default: docker-compose.yml)
#   DB_SERVICE       compose service name     (default: db)
#   BACKUP_DIR       output directory         (default: ./backups)
#   RETENTION_DAYS   delete dumps older than  (default: 14)
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env so POSTGRES_USER / POSTGRES_DB are available.
if [ -f .env ]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PGUSER="${POSTGRES_USER:-speednet}"
PGDB="${POSTGRES_DB:-speednet}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/speednet_${STAMP}.sql.gz"

echo "[$(date -Is)] dumping $PGDB → $OUT"
docker compose exec -T "$DB_SERVICE" pg_dump -U "$PGUSER" "$PGDB" | gzip > "$OUT"

# Prune old backups.
find "$BACKUP_DIR" -name 'speednet_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -Is)] backup complete ($(du -h "$OUT" | cut -f1))"
