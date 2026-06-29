# Architecture & Decisions

## Data model

The 188 messy sheets collapse into these tables. One file per aggregate in
`backend/app/models/`.

```
zones ──1:N── towers ──1:N──┬── links
                            ├── switches
                            ├── sectors
                            └── servers
towers ──self-ref── towers (parent_id, topology)
ip_allocations   (standalone, soft-linked to towers by name/id)
backbone_feeds   (uplink switch → downstream tower, per ETH port)
routing_points   (agent routing tables)
subscribers      (customer lists)
users            (auth)
audit_log        (every change)
```

Full column definitions are in `backend/app/db/schema.sql` (canonical reference;
the SQLAlchemy models mirror it).

### Why almost everything is `text`
The source has VLANs like "10.0", user counts that are sometimes notes, mixed date
formats. Forcing strict types now would reject real data. Store faithfully, tighten
later with validation in Pydantic schemas, not the DB.

### Device "flags"
Each device row carries a `flags` array (e.g. `no-access`, `virtual`,
`placeholder-pass`, `incomplete`). The import script computes these; the UI shows
them. Nothing is deleted on import — bad rows are flagged so a human decides.

---

## CRUD + "transfer between sections"

Every entity has full CRUD. Two kinds of transfer:

1. **Change device type** (link ↔ switch ↔ sector). Implemented as:
   `POST /api/devices/{type}/{id}/transfer` with body `{ "to_type": "sector" }`.
   The CRUD layer reads the row, maps shared fields, inserts into the target table,
   deletes the original, writes an audit entry. Field mapping lives in
   `crud/device.py::TRANSFER_FIELD_MAP`.

2. **Move to another tower**: `PATCH /api/devices/{type}/{id}` with
   `{ "tower_id": <new> }`. Simple FK update.

All mutations write to `audit_log`.

---

## Permissions model

Roles (stored on `users.role`, encoded in the JWT):

| Role | Read | Create/Edit/Delete | Transfer | Manage users | Scope |
|---|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ | everything |
| **editor** | ✅ | ✅ | ✅ | ❌ | everything |
| **viewer** | ✅ | ❌ | ❌ | ❌ | everything |
| **agent** | ✅ | ✅ | ✅ | ❌ | only towers in their `zone_id` / assigned set |

Enforced in two layers:
- **Route dependency** `require_role("editor")` (in `core/deps.py`) gates write
  endpoints.
- **Object scope**: for `agent`, CRUD functions filter/deny by `tower.zone_id`
  against the user's allowed zone(s). Keep this in the CRUD layer so it can't be
  bypassed by a route that forgets to check.

Tokens: short-lived **access** token (~30 min) + longer **refresh** token. Axios
interceptor on the frontend refreshes transparently.

> Build CRUD first with `editor`/`viewer` only. Add `agent` scoping once the basics
> work — it's the fiddly part.

---

## Security (public IP)

- **HTTPS mandatory** — nginx or Caddy with Let's Encrypt. Never serve the API over
  plain HTTP; credentials are in the payloads.
- **Secrets** in `.env`, never committed. `SECRET_KEY` must be long & random.
- **CORS** locked to the frontend origin only (`core/config.py`).
- **Rate limit** the `/auth/login` endpoint (slowapi) to slow brute force.
- **Postgres** not exposed to the internet — only the backend talks to it (compose
  network). No public port mapping for the db service.
- **Backups**: nightly `pg_dump` cron → off-server copy. Document in `deploy/`.
- Passwords stored bcrypt-hashed. Device/network credentials are stored readable by
  design (it's a credential lookup tool) — protect them with auth + HTTPS + role
  scope, and consider an audit trail of who viewed what if needed later.

---

## Frontend state

- **TanStack Query** owns all server data: `useTowers`, `useTower(id)`,
  `useDevices`, mutations with **optimistic updates** so edits feel instant and roll
  back on error.
- No global store needed beyond auth context. Keep component state local.
- The design system is CSS custom properties in `styles/tokens.css`, surfaced to
  Tailwind via `tailwind.config.js`. Don't hardcode hex values in components.
