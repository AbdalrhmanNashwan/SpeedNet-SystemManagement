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
from app.services import monitor

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background IP monitor (pings every DB IP, caches up/down status).
    task: asyncio.Task | None = None
    if settings.MONITOR_ENABLED:
        task = asyncio.create_task(monitor.run_monitor())
    try:
        yield
    finally:
        if task:
            task.cancel()
            try:
                await task
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
