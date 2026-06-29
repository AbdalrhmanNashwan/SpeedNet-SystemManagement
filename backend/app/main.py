"""FastAPI entrypoint."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
