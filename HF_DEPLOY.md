# Deploy free (no credit card): Hugging Face Space + Neon Postgres

This runs the whole app for free with **no credit card**:

- **Hugging Face Space (Docker)** builds this repo's `Dockerfile` and hosts the
  app (FastAPI serving the built React SPA). Free, 16 GB RAM.
- **Neon** provides a free serverless PostgreSQL database. Free, no card.

The app already knows how to talk to Neon — it converts Neon's connection
string to the async driver and enables SSL automatically (see
`backend/app/core/config.py`).

---

## 1. Create a free Neon database

1. Sign up at <https://neon.tech> (GitHub/Google login, no card).
2. Create a project (any name, e.g. `speednet`).
3. On the project dashboard, copy the **connection string**. It looks like:
   ```
   postgresql://speednet_owner:XXXX@ep-cool-name-123.us-east-2.aws.neon.tech/speednet?sslmode=require
   ```
   Keep this — it's your `DATABASE_URL`.

## 2. Create a free Hugging Face Space

1. Sign up at <https://huggingface.co/join> (no card).
2. Go to <https://huggingface.co/new-space>:
   - **Owner**: you · **Space name**: `speednet-console`
   - **SDK**: **Docker** → **Blank**
   - **Hardware**: CPU basic (free) · **Visibility**: Public
   - Create the Space.

## 3. Push this repo to the Space

A Space is its own git repo. From this project folder:

```bash
# use your HF username; you'll be asked for an HF access token as the password
# (create one at https://huggingface.co/settings/tokens — role: write)
git remote add space https://huggingface.co/spaces/<your-hf-username>/speednet-console
git push space main
```

Hugging Face reads the YAML block at the top of `README.md` (`sdk: docker`,
`app_port: 8000`) and starts building the `Dockerfile`. First build ≈ 4–7 min.

## 4. Add the secrets (environment variables)

In the Space → **Settings** → **Variables and secrets** → **New secret**, add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | the Neon connection string from step 1 |
| `SECRET_KEY` | any long random string (e.g. run `openssl rand -hex 32`) |
| `ADMIN_EMAIL` | `admin@speednet.iq` (or your own) |
| `ADMIN_PASSWORD` | a private password |
| `MONITOR_ENABLED` | `false` |
| `BACKUP_ENABLED` | `false` |

Adding secrets restarts the Space. On boot it runs the DB migrations and
creates the admin user automatically.

## 5. Open it

Your app is at:
```
https://<your-hf-username>-speednet-console.hf.space
```
- Public site: `/`
- Console: `/console` → log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` above.

---

## Good to know (free-tier limits)

- **Sleeps after ~48 h idle**; wakes on the next visit.
- **Neon storage**: 0.5 GB and pauses compute after 5 min idle (wakes on
  connect) — plenty for testing.
- **Public Space = public code/logs.** Don't put real secrets anywhere but the
  Secrets panel, and change `ADMIN_PASSWORD` from the defaults.
- **Monitor page** stays off (can't ping private device IPs from the cloud).
- Only `/tmp` is writable on HF — that's why backups are disabled here.

## Notes

- This does **not** deploy from GitHub automatically. Re-deploy by pushing to
  the `space` remote again (`git push space main`).
- The `render.yaml` in this repo is a separate option for Render (needs a card).
