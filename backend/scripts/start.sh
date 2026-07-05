#!/usr/bin/env sh
# Container entrypoint for cloud deploys: apply DB migrations, ensure an admin
# user exists, then start the API/SPA server on the port the host provides.
set -e

echo "-> Running database migrations…"
alembic upgrade head

echo "-> Ensuring admin user…"
python scripts/create_admin.py "${ADMIN_EMAIL:-admin@speednet.local}" "${ADMIN_PASSWORD:-changeme}" || true

echo "-> Starting server on port ${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
