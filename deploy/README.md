# Deploy

Production deployment for the SPEEDNeT Console.

## Files

- `docker-compose.prod.yml` — production overlay (db internal-only, Caddy in front)
- `Caddyfile` — reverse proxy + automatic HTTPS (Let's Encrypt)
- `backup.sh` — nightly `pg_dump` backup with retention

## Bring it up

From the repo root:

```bash
# 1. Fill in production values
cp .env.example .env
#   - set a strong POSTGRES_PASSWORD
#   - set SECRET_KEY=$(openssl rand -hex 32)
#   - set CORS_ORIGINS=["https://net.speednet.iq"]   # your real frontend origin

# 2. Point the domain in deploy/Caddyfile at your host (A/AAAA record)

# 3. Launch (do NOT include docker-compose.override.yml — it exposes Postgres)
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Caddy obtains and renews TLS certificates automatically on first request.

## Backups

Schedule the nightly dump via host cron:

```cron
0 3 * * *  /opt/speednet/deploy/backup.sh >> /var/log/speednet-backup.log 2>&1
```

Dumps land in `./backups/` and are pruned after `RETENTION_DAYS` (default 14).

## Security lockdown (applied)

- **Postgres** has no published port in the prod overlay — only `backend` reaches
  it on the internal Docker network.
- **CORS** is driven by `CORS_ORIGINS` in `.env`; set it to the frontend origin.
- **Login** is rate-limited to 5 attempts/minute per IP (slowapi).
- **Backend** is not published to the host; Caddy proxies to it internally.
