# Deploy a free test instance on Render

This spins up the whole app — FastAPI backend, the built React frontend, and a
PostgreSQL database — on Render's **free** tier, straight from this repo. It's
meant for quick testing before you move to a real server.

## What you get

- **One web service** (`speednet-console`): a Docker image where FastAPI serves
  both the API (`/api`) and the built SPA, so everything is on one URL — no CORS,
  no separate frontend host.
- **One free Postgres** (`speednet-db`).

Defined by [`render.yaml`](./render.yaml) + [`Dockerfile`](./Dockerfile).

## Steps

1. **Push this repo to GitHub** (Render deploys from a Git repo):
   ```bash
   git add -A
   git commit -m "Add Render deploy config"
   git remote add origin https://github.com/<you>/speednet-console.git   # if not set
   git push -u origin main
   ```

2. **Create the blueprint on Render**
   - Sign in at <https://render.com> (free, no card).
   - **New +** → **Blueprint** → connect the GitHub repo → Render reads
     `render.yaml` and shows the service + database → **Apply**.

3. **Wait for the first build** (~3–6 min). On boot the container runs migrations
   and seeds the admin user automatically.

4. **Open the app** at the service URL Render gives you, e.g.
   `https://speednet-console.onrender.com`
   - Public site: `/`
   - Console login: `/console`  → `admin@speednet.iq` / `Admin2024!`
     (override via the `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars in render.yaml).

## Good to know (free-tier limits)

- **Sleeps when idle**: after ~15 min of no traffic the service spins down; the
  next request takes ~50s to wake. Normal for free.
- **Database expires after 30 days**: Render deletes free Postgres instances on a
  30-day clock. Fine for a test; take a backup before then if you need the data.
- **Monitor page won't ping**: it targets private device IPs that the cloud can't
  reach (and raw ICMP is blocked), so `MONITOR_ENABLED` is off here. Everything
  else — towers, users, IP allocations, the public site — works normally.
- **Change the seeded password** before sharing the link publicly.

## Local dev is unchanged

None of this affects running locally. The frontend still runs under Vite on
:5173 and the backend under uvicorn on :8000 (`./start.ps1`). FastAPI only serves
the SPA when a built `static/` dir is present, which happens inside the Docker
image — not in your local checkout.
