# Claude Code — Build Checklist

Work top to bottom. Each task is small and verifiable. ✅ scaffolded already.

## Phase 0 — Boot the environment
- [x] `cp .env.example .env`, fill `POSTGRES_PASSWORD`, `SECRET_KEY` (run `openssl rand -hex 32`)
- [x] `docker compose up -d db` and confirm Postgres is reachable
- [x] `cd backend && pip install -r requirements.txt`

## Phase 1 — Database
- [x] `db/schema.sql` — canonical schema (reference)
- [x] `models/` — SQLAlchemy models (tower, device, zone, user, audit, misc)
- [x] Wire `alembic` to the models; `alembic revision --autogenerate -m "init"`; `alembic upgrade head`
- [x] Verify tables exist and match `schema.sql`

## Phase 2 — Load the data
- [x] `scripts/import_sheet.py` — reads `data/app_data.json`, inserts towers + devices + zones + ip + backbone, computes flags
- [x] Run it; confirm counts: 175 towers, 403 links, 145 switches, 914 sectors, 379 IPs
- [x] Spot-check برج النجار has its 6 switches + 40 sectors

## Phase 3 — Auth
- [x] `core/security.py` — hash/verify password, create/decode JWT
- [x] `core/deps.py` — `get_db`, `get_current_user`, `require_role`
- [x] `api/routes/auth.py` — `/login`, `/refresh`, `/me` (login stub provided, finish refresh)
- [x] Seed an admin user (add to import script or a `create_admin.py`)
- [x] Test: login returns tokens; `/me` returns the user

## Phase 4 — CRUD API
- [x] `crud/base.py` — generic async CRUD
- [x] `api/routes/towers.py` — full CRUD
- [x] `api/routes/devices.py` — CRUD + **transfer** endpoint (section + tower)
- [x] `api/routes/zones.py` (+ rule-based `recompute`), `ip.py`, `users.py`, `audit_route.py`
- [x] Every mutation writes an `audit_log` row (helper in `crud/audit.py`)
- [x] All routers wired in `api/router.py` — **28 endpoints, validated**
- [ ] (optional) add `routing_points` + `subscribers` routes if you surface those in UI

## Phase 5 — Frontend foundation
- [x] Vite + TS + Tailwind config, `styles/tokens.css` (design system)
- [x] `lib/api.ts` — axios instance + auth/refresh interceptors
- [x] `types/index.ts` — types mirroring the API
- [x] `hooks/useAuth.tsx` — auth context + login/logout
- [x] `hooks/useTowers.ts`, `useDevices.ts` — TanStack Query hooks (tower hook stubbed)
- [x] `App.tsx` routes + protected-route wrapper (skeleton provided)

## Phase 6 — Pages (port the static mockup)
The static app `SPEEDNeT_App.html` (separate download) is the reference for layout &
behavior. Re-implement its views as components:
- [x] `pages/Login.tsx`
- [x] `pages/Home.tsx` — lenses + zone bubbles
- [x] `pages/ZonePage.tsx` — adaptive middle page + backbone
- [x] `pages/TowerList.tsx` — grouped cards + filter
- [x] `pages/TowerDetail.tsx` — meta grid + device tables
- [x] `pages/SearchResults.tsx`
- [x] `components/TowerCard.tsx`, `components/DeviceTable.tsx`, `components/EditableField.tsx` (starters)

## Phase 7 — Editing UI (the core ask)
- [x] `EditableField` — click any field to edit inline, save via mutation, optimistic
- [x] Row actions on every device table row: **Edit · Delete · Transfer**
- [x] "Add" button per section (add link/switch/sector to a tower)
- [x] Add / edit / delete towers; add / edit zones
- [x] Transfer dialog: pick target type or target tower
- [x] Confirm dialogs for delete; toast on success; rollback on error

## Phase 8 — Permissions
- [x] Hide/disable edit controls for `viewer`
- [x] `agent` sees & edits only their zone (enforced server-side already; reflect in UI)
- [x] `pages/Users.tsx` (admin only) — create users, set role/zone

## Phase 9 — Deploy
- [x] `frontend/Dockerfile` build → nginx serves `dist/`, proxies `/api`
- [x] HTTPS via Let's Encrypt (Caddy is simplest; config stub in `deploy/`)
- [x] Nightly `pg_dump` backup script in `deploy/`
- [x] Lock down: db has no public port; CORS = frontend origin; login rate-limited

## Definition of done
A team member logs in, finds a tower by search, sees a wrong value, fixes it inline,
moves a mis-filed sector into Switches, deletes a junk row — and it all persists and
shows in the audit log, with viewers unable to edit.
