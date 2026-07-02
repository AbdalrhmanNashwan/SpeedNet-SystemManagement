# SPEEDNeT Console — 1-Year Hosting Budget (Reliability-First)

_Prepared: 2026-07-01. USD, list prices, **per year** unless noted._
_Goals: the IP monitor (ping) must run **24/7 without gaps**, the app must handle
**many concurrent users**, and we want to **avoid server problems**. No `.iq` domain._

---

## The one architecture change this needs (important)

The ping monitor runs **inside the API process** today. To serve many users you run
**multiple API workers** — but each worker would then start its own monitor loop and
**ping every IP N times + duplicate alerts**. So before scaling we split into:

- **API service** — uvicorn/gunicorn with several workers (scales with users).
  `MONITOR_ENABLED=false`, `BACKUP_ENABLED=false` here.
- **Worker service** — ONE container that runs only the monitor + backups
  (`MONITOR_ENABLED=true`). Single instance = pings each IP once, one alert stream.
- **PostgreSQL**, **reverse proxy (Caddy = auto HTTPS)**, all behind **Cloudflare**.

This is a small, well-contained change to `docker-compose.yml` + config. It's what makes
"reliable ping" and "lots of users" both true at once. _(I can implement it.)_

---

## RECOMMENDED (reliable) PLAN → **~$230 / year**

Everything on one strong VPS, but split into API + monitor + DB containers, with
auto-restart, health checks, and offsite backups.

| # | Item | Provider / spec | Per year |
|---|------|-----------------|---------:|
| 1 | **VPS** | Hetzner CPX41 — **4 vCPU, 8 GB RAM, 160 GB SSD, 20 TB** | **~$210** (≈€16/mo) |
| 2 | **Domain (.com)** | Cloudflare Registrar / Porkbun | **~$10** |
| 3 | **SSL** | Let's Encrypt via Caddy (auto-renew) | **$0** |
| 4 | **Cloudflare** | Free plan — DNS, CDN, DDoS, caches the static frontend | **$0** |
| 5 | **Offsite backups** | Cloudflare R2 (free tier) / Backblaze B2 | **~$0–6** |
| 6 | **Uptime + monitor watchdog** | UptimeRobot / BetterStack free | **$0** |
| | | | **≈ $220–230 / yr** |

Handles dozens of simultaneous users easily; `/monitor/status` is a cheap in-memory read,
so more viewers ≠ more ping load. Auto-restart keeps the monitor running through crashes/reboots.

**Monthly equivalent: ~$19/month.**

---

## MAXIMUM RELIABILITY PLAN → **~$430 / year**  (recommended if downtime is costly)

Removes the two biggest "server problem" risks: the database and a single machine.

| # | Item | Provider / spec | Per year |
|---|------|-----------------|---------:|
| 1 | **App VPS** | 4 vCPU, 8 GB (Hetzner CPX41 / DO / Linode) | ~$210 |
| 2 | **Managed PostgreSQL** | DigitalOcean/Linode managed, daily backups + point-in-time restore, auto-patching | ~$180 ($15/mo) |
| 3 | **Domain (.com)** | Cloudflare | ~$10 |
| 4 | **SSL** | Let's Encrypt | $0 |
| 5 | **Cloudflare** | Free (or Pro $240/yr for advanced WAF — optional) | $0 |
| 6 | **Offsite backups** | Backblaze B2 | ~$6 |
| 7 | **Uptime monitoring** | BetterStack paid (SMS/phone alerts) | ~$0–24 |
| | | | **≈ $410–430 / yr** |

Managed DB = the part most likely to cause "server problems" is now someone else's job
(failover-ready backups, patching, tuning). Worth it once the console is business-critical.

---

## OPTIONAL — true redundancy for the ping (no gaps ever)

| Add-on | Why | Per year |
|--------|-----|---------:|
| **2nd small VPS as standby / dedicated ping node** | if the main box dies, monitoring + app still up | ~$54–84 |
| VPS daily snapshots | 1-click full restore of the whole machine | ~$40 (≈20% of VPS) |
| Cloudflare Pro | managed WAF rules, image/cache tuning | ~$240 |

A second ping node also lets you **ping from two vantage points** — fewer false "down"
alerts caused by one site's uplink hiccup.

---

## Bottom line

| Plan | 1-year total |
|------|-------------:|
| **Recommended (reliable, single strong VPS)** | **~$230** |
| **Maximum reliability (managed DB)** | **~$430** |
| + standby ping node / snapshots | **+$90–125** |

**Recommendation:** go with the **Recommended reliable plan (~$230/yr)** and the
architecture split above. Add **managed PostgreSQL** (→ ~$430/yr) if the console becomes
critical enough that a DB outage would hurt the business.

---

## Reliability checklist (what actually prevents "server problems")

- [ ] **Split API (many workers) from a single monitor worker** — see top of doc. _(needs code/compose change)_
- [ ] **`restart: unless-stopped`** on every container (survives crashes & reboots).
- [ ] **Health checks** on API (`/health`) and DB; auto-restart on failure.
- [ ] **Caddy** in front for automatic, auto-renewing HTTPS (zero cert maintenance).
- [ ] **Cloudflare** in front for DNS, CDN (serves the React build), and DDoS absorption.
- [ ] **Nightly offsite backup copy** to R2/B2 (app already makes the archives locally).
- [ ] **External uptime monitor** hitting `/health` every 1–5 min → alert if the box dies.
- [ ] **Real `.env` secrets** before launch: `SECRET_KEY` (`openssl rand -hex 32`),
      DB password, `CORS_ORIGINS` = your domain. (Defaults in `config.py` are insecure.)
- [ ] **Postgres connection pool** sized for the worker count (avoid exhausting connections
      under load) — set in `app/db/session.py` when we do the split.
- [ ] **VPS region close to Iraq** (Hetzner DE/FI, or a UAE/Bahrain region elsewhere) for latency.
- [ ] **Swap file + basic tuning** on the VPS so a memory spike doesn't OOM-kill the monitor.
