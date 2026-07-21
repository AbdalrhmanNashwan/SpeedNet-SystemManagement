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
# Only seed an admin when a password is explicitly provided. Never fall back to
# a hard-coded default ("changeme") — a deploy that forgets ADMIN_PASSWORD would
# otherwise boot with publicly-known admin credentials.
if [ -n "${ADMIN_PASSWORD}" ]; then
  python scripts/create_admin.py "${ADMIN_EMAIL:-admin@speednet.local}" "${ADMIN_PASSWORD}" || true
else
  echo "   ADMIN_PASSWORD not set — skipping admin seed. Set ADMIN_EMAIL/ADMIN_PASSWORD to create the first admin." >&2
fi

echo "-> Starting server on port ${PORT:-8000}…"
# --proxy-headers + --forwarded-allow-ips lets the app see the real client IP
# from X-Forwarded-For (set by the host's proxy) instead of the proxy's own IP,
# so per-IP login rate limiting works in production.
#
# IMPORTANT: only TRUSTED proxy addresses may be listed here. With "*", a client
# can spoof X-Forwarded-For and forge any source IP, which defeats the per-IP
# login rate limit (each forged IP looks like a new client). Default to the
# local proxy (Caddy on the same host); override FORWARDED_ALLOW_IPS with the
# real proxy address/subnet for other topologies.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" \
  --proxy-headers --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
