# SPEEDNeT Console — Production Runbook (this server, WSL2 Docker)

Actual deployment topology on this machine (Windows 10, Docker Engine inside a
WSL2 Ubuntu distro — not Docker Desktop, not bare-metal Ubuntu). This is the
accurate runbook for *this* box; `deploy/R710_RUNBOOK.md` in the repo is a
generic template for a different (bare-metal) scenario and doesn't match how
this one is actually running.

- **Repo path:** `/home/msr/SpeedNet-SystemManagement` (inside WSL2 Ubuntu)
- **Public URL (HTTPS, live since 2026-07-22):** `https://speednetiq.duckdns.org/`
  · admin console: `https://speednetiq.duckdns.org/console` — plain HTTP
  auto-redirects (308) to HTTPS via Caddy. The bare IP (`http://65.20.204.53/`)
  still works too but isn't the canonical URL anymore.
- **Admin login:** `admin@speednet.local` / (see `.env` → `ADMIN_PASSWORD` — change
  it after first login via the console's user settings, not by editing `.env`;
  see rotation section below for why)
- **Owner account** (`abdalrhmannash.dev@gmail.com`, hardcoded in
  `backend/app/api/routes/users.py` as `OWNER_EMAIL`) is a separate, protected
  super-admin account — only it can edit itself, and no one (not even another
  admin) can demote/delete it via the API.

All commands below are run **inside the WSL2 Ubuntu shell**. From Windows,
either open a terminal and run `wsl -d Ubuntu`, or prefix any single command
with `wsl -d Ubuntu -e bash -c "..."`.

## Start / stop / update

```bash
cd /home/msr/SpeedNet-SystemManagement

# start (or apply changes after editing .env)
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d

# stop
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml down

# update to latest code
git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

**Always include both `-f` files together now** (base + `deploy/docker-compose.prod.yml`,
which adds the `caddy` service for HTTPS and stops publishing frontend/backend
ports directly to the host). Never add `docker-compose.override.yml` (it's
intentionally renamed to `docker-compose.override.yml.DO-NOT-USE-IN-PROD` in
this repo) — it publishes Postgres on `5432` to the network, which must stay closed.

**A subtlety if you ever edit `deploy/docker-compose.prod.yml`:** its `backend`
and `frontend` blocks use `ports: !override []`, not plain `ports: []`. Plain
`ports: []` in an overlay does **not** clear the base file's port list — Compose
concatenates list-type fields across `-f` files by default, so the base file's
`"80:80"` would stay published and collide with Caddy trying to bind the same
port. The `!override` YAML tag forces a real replace. This bit us once already
(2026-07-22) — don't remove the tag.

## HTTPS / domain (Caddy + Let's Encrypt + DuckDNS)

- **Domain:** `speednetiq.duckdns.org`, a free DuckDNS subdomain pointed at
  this server's public IP.
- **Cert:** obtained and auto-renewed by the `caddy` container (config at
  `deploy/Caddyfile`) — no certbot, no manual renewal.
- **Keeping DNS current:** DuckDNS needs to be told the public IP any time it
  changes. `C:\SpeedNet\scripts\duckdns-update.ps1` calls DuckDNS's update API
  and is run every 5 minutes by the **`SpeedNet-DuckDNS-Update`** scheduled
  task (log: `C:\SpeedNet\logs\duckdns-update.log`). Cheap/harmless to run even
  when the IP hasn't changed (DuckDNS just replies `NOCHANGE`).
- **Router:** port 443 (TCP) must be forwarded to this PC's LAN IP
  (`192.168.0.194`), same as port 80 already was. If HTTPS ever starts serving
  a certificate for `tplinkwifi.net` (or your router's own hostname) instead
  of `speednetiq.duckdns.org`, that means the router's own admin/remote-management
  page is answering on 443 instead of forwarding it — check the router's port
  forwarding and "Remote Management via HTTPS" settings (this happened once,
  see 2026-07-22 notes).
- **Windows-side forwarding:** same `netsh portproxy` mechanism as port 80 (see
  below), now covering both 80 and 443 — handled automatically by the same
  self-heal scripts.

## Logs

```bash
cd /home/msr/SpeedNet-SystemManagement
docker compose logs -f              # all services
docker compose logs -f backend      # just the API (migrations, monitor, errors)
docker compose logs -f frontend
docker compose logs -f db
docker compose logs -f caddy        # TLS cert issuance/renewal, reverse proxy
```

## Auto-deploy (push to main → live in ≤5 min)

`deploy/auto-deploy.sh` runs from cron every 5 minutes and deploys whenever
`origin/main` advances. Log: `/mnt/e/deploy/logs/auto-deploy.log` = `E:\deploy\logs\`.

**It fails safe.** The previous commit is captured *before* the fast-forward,
so any failure (merge, build, or health check) resets the repo to it and
rebuilds the last known-good stack. Health is verified, not assumed: the API
must answer `/health` **and** Caddy must reach the frontend — containers
reporting "Started" isn't enough, because the backend runs migrations at
startup and can die afterwards.

A failed commit is recorded in `.auto-deploy.failed` and skipped from then on,
so a bad commit doesn't retry-loop every 5 minutes. **Deploys resume by
themselves once you push a fix.** Failures and recoveries are pushed to
Telegram.

**Gotcha that already bit us once:** git tracks the executable bit. Someone ran
`chmod +x` on `auto-deploy.sh` on the server while git had it as 644, which
left the production repo permanently dirty on a mode change and silently
blocked `git merge --ff-only`. Both scripts are now committed as 755. If a
deploy ever stops with *"Please commit your changes or stash them"*, check
`git status` on the server first.

To force a deploy immediately instead of waiting for the tick:
```bash
ssh MSR@100.95.52.74 "wsl -d Ubuntu -e bash /home/msr/SpeedNet-SystemManagement/deploy/auto-deploy.sh"
```

## Backups

Three independent mechanisms:

1. **App-level CSV/zip backups (active):** the backend itself writes timestamped
   `backup_*.zip` files continuously (`BACKUP_ENABLED=true` in `.env`). They're
   bind-mounted from the container's `/code/backups` to the host at
   **`/mnt/e/deploy/backups`** (WSL) = **`E:\deploy\backups`** (Windows) — a
   separate disk from the OS/container filesystem, as intended. Verify with:
   ```powershell
   Get-ChildItem E:\deploy\backups | Sort-Object LastWriteTime -Descending | Select -First 5
   ```
2. **`deploy/backup.sh` — nightly `pg_dump` (ACTIVE since 2026-07-24):** runs
   from cron at **03:00** and writes gzipped SQL dumps to
   **`/mnt/e/deploy/pgdumps`** = **`E:\deploy\pgdumps`**, keeping 14 days.
   Log: `/mnt/e/deploy/logs/backup.log`. It writes to a `.part` file and only
   renames on success, verifies the result is valid gzip *and* contains the
   core tables, and alerts Telegram if the dump fails — a backup that fails
   quietly is worse than no backup.

   *Note:* the script deliberately reads only `POSTGRES_USER`/`POSTGRES_DB`
   out of `.env` rather than sourcing it. Sourcing would also import
   `BACKUP_DIR=/code/backups`, a path that only exists **inside** the backend
   container, silently redirecting host-side dumps somewhere nobody looks.

3. **`deploy/pull-backups.ps1` — offsite copy to the laptop (run from the
   laptop).** This is the one that actually makes backups offsite: `E:\deploy`
   is a second disk in the *same machine*, which is no defence against fire,
   theft, ransomware or a PSU that takes the drives with it.
   ```powershell
   .\deploy\pull-backups.ps1          # pulls new dumps over Tailscale to %USERPROFILE%\SpeedNet-Backups
   ```
   Safe to re-run (skips what it already has), prunes to the newest 30, and
   does nothing harmful if the server is off. The script's footer has the
   `Register-ScheduledTask` snippet to run it daily.

**Restoring:** `zcat speednet_YYYYMMDD_HHMMSS.sql.gz | docker compose exec -T db psql -U speednet -d speednet`

## Rotating `SECRET_KEY`

```bash
cd /home/msr/SpeedNet-SystemManagement
nano .env                                    # set SECRET_KEY to a new value, e.g.:
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
docker compose -f docker-compose.yml up -d --build backend
```
This **invalidates every existing login session** — everyone (including you)
has to log in again. There's no way around that; it's how JWT signing works.

## Rotating passwords

**Admin / user passwords — via the app, not `.env`:** editing `ADMIN_PASSWORD`
in `.env` and restarting does **nothing** to an existing user — `start.sh`
only seeds the admin account once; if the email already exists it's left
untouched (confirmed in `backend/scripts/create_admin.py`). To actually change
a password:
- In the console: log in as admin → **Users** → edit the user → set a new
  password (min 8 chars). This calls `PATCH /api/users/{id}` with a `password`
  field, which also bumps `token_version` — that user's existing sessions are
  invalidated immediately, everyone else's are unaffected.

**`POSTGRES_PASSWORD` — needs an explicit DB-side change, not just `.env`:**
Postgres only reads `POSTGRES_PASSWORD` when it initializes an **empty** data
volume. This DB already has data, so editing `.env` alone does nothing — the
running Postgres still has the old password, and the backend will fail to
connect once you point `DATABASE_URL` at a new one it doesn't know about yet.
Do it in this order:
```bash
cd /home/msr/SpeedNet-SystemManagement
# 1. change the password inside Postgres itself
docker compose exec db psql -U speednet -d speednet \
  -c "ALTER ROLE speednet WITH PASSWORD 'NEW_PASSWORD_HERE';"
# 2. update .env: POSTGRES_PASSWORD and the password portion of DATABASE_URL
nano .env
# 3. restart backend so it picks up the new DATABASE_URL
docker compose -f docker-compose.yml up -d backend
```

## If the site suddenly stops responding (public IP / LAN IP / even 127.0.0.1 all time out)

This happened on 2026-07-22. **The containers can be perfectly healthy and this
still breaks the site** — check this before assuming an app problem:

- **Cause:** WSL2 assigns Ubuntu a new internal IP every time it restarts. A
  `netsh interface portproxy` rule forwards Windows host port 80 to that
  internal IP (this is how the site is actually reachable — WSL2's own
  built-in `localhost` forwarding was unreliable on this box). If WSL2
  restarts (Windows reboot, `wsl --shutdown`, crash) and that rule isn't
  refreshed, it keeps forwarding to the old, now-dead IP — Windows shows a
  listener on port 80, but every connection just times out.
- **Check it:**
  ```powershell
  netsh interface portproxy show all      # note the "Connect to" IP
  wsl -d Ubuntu -e bash -c "hostname -I"  # compare to WSL2's actual current IP
  ```
  If they don't match, that's the bug.
- **Fix it (needs an elevated PowerShell):**
  ```powershell
  $wslIp = (wsl -d Ubuntu -e bash -c "hostname -I").Trim().Split(" ")[0]
  netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0
  netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=$wslIp
  ```
- **This is now automated and covers both port 80 and 443:**
  `C:\SpeedNet\scripts\wsl-start-and-refresh-portproxy.ps1` (runs at every
  Windows logon via `SpeedNet-WSL-AutoStart`) and
  `C:\SpeedNet\scripts\ensure-running.ps1` (runs on-demand from the
  **"SpeedNet Console"** desktop shortcut, *and* automatically every 5 minutes
  via the **`SpeedNet-Ensure-Running`** scheduled task) both refresh whichever
  of the two ports has drifted. Logs: `C:\SpeedNet\logs\portproxy-refresh.log`
  and `C:\SpeedNet\logs\ensure-running.log`.

## Desktop shortcut & self-healing

- **"SpeedNet Console" shortcut** (Desktop) runs `C:\SpeedNet\scripts\open-console.ps1`:
  if the site's already up, it opens the browser in well under a second; if
  not, it triggers the elevated `SpeedNet-Ensure-Running` task (no UAC prompt —
  pre-authorized) to start WSL2/Docker and fix port forwarding, then opens the
  browser once it's actually responding.
- **`SpeedNet-Ensure-Running`** also runs on its own every 5 minutes
  (independent of the shortcut), so a crashed container, a stopped WSL2
  instance, or a stale portproxy rule generally self-heals within 5 minutes
  with no one touching anything — **but only while a user (MSR) is logged into
  Windows**, since the task's logon type is Interactive. See the unattended
  reboot gap below.
- **Power settings:** sleep/hibernate are disabled (AC and DC) — confirmed via
  `powercfg /query SCHEME_CURRENT SUB_SLEEP`, both show `0x00000000`.
- **Windows Update:** set to notify-only (`AUOptions=2`) with
  `NoAutoRebootWithLoggedOnUsers=1` — it won't silently install updates or
  force a reboot.

## Monitoring, alerts and uptime history

- **Alerting was dead until 2026-07-24** — not a code bug: the server `.env`
  simply had no `ALERT_*` lines, so `ALERT_ENABLED` defaulted to false and the
  alert engine returned immediately on every sweep. Both the Telegram channel
  and the in-app notification bell were empty for that reason.
  **The server `.env` is not in git and does not track `deploy/env.prod.example`
  — auto-deploy rebuilds code but never touches it, so any NEW backend setting
  silently falls back to its `config.py` default in production until someone
  adds it here.**
- Telegram goes to the group **"Speed Net Alerts"** via bot `@SpeedNetAlerts_bot`.
  Admins can verify the channel end-to-end from the console: **🔔 bell →
  "Send test"**. It reports Telegram's own rejection text, so a bad token or a
  chat that never messaged the bot is visible instead of looking like a quiet
  network.
- **Outage history (`outage_events`)** is recorded independently of alerting.
  Alerting is throttled on purpose (cooldowns, the mass-outage freeze) and
  reusing those gates would leave holes in the history. Surfaced at
  **`/console/uptime`**: per-IP SLA summary and the full outage log.
- The monitor currently tracks **~1591 IPs**.

## Known open items (not silently resolved)

- **Unattended reboot gap — RESOLVED 2026-07-23.** Both **`SpeedNet-WSL-AutoStart`**
  (trigger: At system start up) and **`SpeedNet-Ensure-Running`** (5-min repeat)
  are now set to **"Run whether user is logged on or not"** (`LogonType=Password`,
  `RunLevel=HighestAvailable`). After a real power loss/reboot the stack now
  comes up and self-heals with **no login required**. Note: because the tasks
  store MSR's Windows password, changing that Windows password later will break
  both tasks until the password is re-entered in Task Scheduler.
- **BIOS "AC Power Recovery"** (auto power-on after an actual power outage) is
  outside Windows entirely — can't be set from here. Check it in BIOS setup if
  you want the physical machine to power back on by itself after a real outage.
- **Device monitor depends on the `obpvpn.earthlink.iq` OpenVPN tunnel** being
  connected on this Windows host — that's how the box reaches the `10.x.x.x`
  device network. It does **not** reconnect automatically after a reboot; if
  the monitor ever shows everything down again, check whether that VPN dropped
  (OpenVPN Connect app, system tray) before assuming it's an app problem.
