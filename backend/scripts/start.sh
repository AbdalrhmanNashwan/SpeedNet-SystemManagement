#!/usr/bin/env sh
# Container entrypoint: wait for the DB, apply migrations, ensure an admin user
# exists, then start the API/SPA server on the port the host provides.
set -e

echo "-> Waiting for database & applying migrations…"
n=0
until alembic upgrade head; do
  n=$((n + 1))
  if [ "$n" -ge 30 ]; then
    echo "   migrations still failing after 30 attempts — giving up" >&2
    exit 1
  fi
  echo "   database not ready yet (attempt $n) — retrying in 2s…"
  sleep 2
done

echo "-> Ensuring admin user…"
python scripts/create_admin.py "${ADMIN_EMAIL:-admin@speednet.local}" "${ADMIN_PASSWORD:-changeme}" || true

echo "-> Starting server on port ${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
