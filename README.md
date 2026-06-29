# SPEEDNeT Console

A network management console for SPEEDNeT ISP — turns a messy 188-sheet Google
Sheet into a clean, searchable, **fully editable** web app backed by PostgreSQL.

> **Status:** scaffold + spec. The architecture, schema, data pipeline, auth model,
> and key files are in place. This document is the handoff for completing the build
> in Claude Code.

---

## 1. What this app does

- Browse the whole network by **zones** (SPEED, سنوني…), **areas**, **topology**,
  **resellers**, **status**, **device type**, or a flat tower list.
- Drill: **zone → adaptive middle page → towers → tower detail → credentials**.
- **Global search** across every tower, link, switch, sector, and IP allocation.
- **Full CRUD on everything** — add / edit / delete any tower, device, or field.
- **Transfer** a device between sections (link ↔ switch ↔ sector) or to another tower.
- **Role-based access** — admin / editor / viewer / agent, by login.
- **Audit log** — every change records who, what, when.

The source data is messy (wrong values, rows in the wrong section). The whole point
of the editing layer is to let the team **fix it in place** over time.

---

## 2. Tech stack (decided — don't re-litigate unless you have a reason)

| Layer | Choice | Why |
|---|---|---|
| Database | **PostgreSQL 16** | Relational data (towers→devices), runs on the company server |
| ORM | **SQLAlchemy 2.0** (async) | Best-practice Python ORM, async fits FastAPI |
| Migrations | **Alembic** | Schema versioning |
| API | **FastAPI** | You know it; async, typed, auto OpenAPI docs |
| Validation | **Pydantic v2** | Request/response schemas |
| Auth | **JWT** (python-jose) + **bcrypt** (passlib) | Access + refresh tokens, role claims |
| Frontend | **React 18 + Vite + TypeScript** | Component-per-file, you've used React+Vite |
| Server state | **TanStack Query** | Caching, optimistic updates, refetch — ideal for CRUD |
| Routing | **React Router v6** | Standard |
| Styling | **Tailwind CSS** + custom design tokens | The navy/cyan theme is encoded as tokens |
| HTTP | **Axios** (one configured instance) | Interceptors for auth + refresh |
| Deploy | **Docker Compose** (postgres + backend + nginx) | Reproducible on the local server |
| TLS | **Let's Encrypt** via nginx/Caddy | Public IP must be HTTPS |

---

## 3. Architecture

```
                 ┌────────────────────────────────────────┐
   Browser  ───► │  nginx  (HTTPS, serves built frontend)  │
                 │         /api/* ─► proxy to FastAPI       │
                 └───────────────┬────────────────────────┘
                                 │
                 ┌───────────────▼────────────────────────┐
                 │  FastAPI                                │
                 │   api/routes/  auth, towers, devices,   │
                 │                zones, ip, users, audit  │
                 │   crud/        DB operations            │
                 │   core/        config, security, deps   │
                 └───────────────┬────────────────────────┘
                                 │ SQLAlchemy (async)
                 ┌───────────────▼────────────────────────┐
                 │  PostgreSQL  (schema in db/schema.sql)  │
                 └─────────────────────────────────────────┘
```

See `docs/ARCHITECTURE.md` for the full reasoning and the permissions model.

---

## 4. Repository layout

```
speednet-console/
├── README.md                  ← you are here
├── docker-compose.yml         ← postgres + backend + frontend(nginx)
├── .env.example               ← copy to .env and fill secrets
├── docs/
│   ├── ARCHITECTURE.md        ← decisions, permissions, data model
│   ├── API.md                 ← endpoint contract
│   └── CLAUDE_CODE_TASKS.md   ← ordered build checklist (START HERE in Claude Code)
├── data/
│   └── app_data.json          ← cleaned data seed (from the Google Sheet)
├── backend/
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── Dockerfile
│   └── app/
│       ├── main.py            ← FastAPI app + router mount + CORS
│       ├── core/
│       │   ├── config.py      ← settings via env
│       │   ├── security.py    ← JWT + password hashing
│       │   └── deps.py        ← get_db, get_current_user, require_role
│       ├── db/
│       │   ├── base.py        ← Declarative base + model imports
│       │   ├── session.py     ← async engine + session
│       │   └── schema.sql     ← canonical Postgres schema (reference)
│       ├── models/            ← SQLAlchemy models (one file per aggregate)
│       ├── schemas/           ← Pydantic request/response models
│       ├── crud/              ← reusable CRUD + per-entity logic
│       └── api/
│           ├── router.py      ← mounts all route modules
│           └── routes/        ← auth, towers, devices, zones, ip, users, audit
│   └── scripts/
│       └── import_sheet.py    ← one-time loader: app_data.json → Postgres
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── index.html
    ├── Dockerfile
    └── src/
        ├── main.tsx
        ├── App.tsx            ← routes
        ├── styles/tokens.css  ← the navy/cyan design system
        ├── lib/api.ts         ← axios instance + auth interceptors
        ├── types/index.ts     ← TS types mirroring the API
        ├── hooks/             ← useTowers, useDevices, useAuth (TanStack Query)
        ├── components/        ← TowerCard, DeviceTable, EditableField, …
        └── pages/             ← Home, ZonePage, TowerDetail, Login, …
```

---

## 5. Quick start (once built)

```bash
cp .env.example .env            # fill POSTGRES_PASSWORD, SECRET_KEY, etc.
docker compose up -d            # starts postgres + backend + frontend
docker compose exec backend alembic upgrade head      # create tables
docker compose exec backend python scripts/import_sheet.py   # load data
# open https://<server-ip>
```

---

## 6. Where to start in Claude Code

Open **`docs/CLAUDE_CODE_TASKS.md`** — it's an ordered checklist. The scaffold gives
you working config, models, schema, auth, the data importer, and the design system.
The tasks fill in the remaining routes, hooks, and pages.

Build order: **backend models → migrations → import data → auth → CRUD routes →
frontend api/types → pages → editing UI → permissions → deploy.**
