"""FastAPI entrypoint."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
import app.models  # noqa: F401  (register models)
from app.api.router import api_router
from app.services import monitor, backup

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background workers: IP monitor (ping status) + periodic CSV backups.
    tasks: list[asyncio.Task] = []
    if settings.MONITOR_ENABLED:
        tasks.append(asyncio.create_task(monitor.run_monitor()))
    if settings.BACKUP_ENABLED:
        tasks.append(asyncio.create_task(backup.run_backup()))
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        for t in tasks:
            try:
                await t
            except asyncio.CancelledError:
                pass


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Rate limiting (used by login; see app.api.routes.auth)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch anything not already handled: log the FULL detail server-side, and
    return a generic JSON message so no traceback / paths / SQL leak to clients.
    (Explicit HTTPExceptions keep their own tailored, safe messages.)"""
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Serve the built frontend (single-container / PaaS deploys).
#
# In local dev the frontend runs under Vite on its own port and this block is a
# no-op (the dist directory does not exist). In the Docker image used for cloud
# hosting, the built SPA is copied to ``FRONTEND_DIST`` and FastAPI serves it —
# so the API (/api) and the app share one origin (no CORS, no proxy needed).
# ---------------------------------------------------------------------------
_dist = Path(os.getenv("FRONTEND_DIST", "/code/static"))
if _dist.is_dir():
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        # Unknown API paths must get a consistent JSON 404 — never the SPA shell.
        if full_path == "api" or full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        # Serve a real static file if one exists (favicon, robots.txt, …),
        # otherwise fall back to index.html so the client-side router handles
        # the route (covers both "/" and "/console/…").
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(_dist.resolve()):
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
