# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Single-image build for PaaS hosts (Render, Fly, etc.):
#   stage 1 — build the Vite frontend
#   stage 2 — Python backend that ALSO serves the built frontend
# The API and the SPA end up on one origin, so no CORS / proxy is needed.
# ---------------------------------------------------------------------------

# ---- stage 1: build frontend ----
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- stage 2: backend + static ----
FROM python:3.12-slim
WORKDIR /code

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
# built SPA served by FastAPI (see app/main.py -> FRONTEND_DIST)
COPY --from=frontend /fe/dist ./static
ENV FRONTEND_DIST=/code/static
# make the `app` package importable for alembic / scripts (cwd isn't on the
# path when console entrypoints like `alembic` run)
ENV PYTHONPATH=/code

EXPOSE 8000
CMD ["sh", "/code/scripts/start.sh"]
