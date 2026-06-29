"""Automatic database backups.

Every BACKUP_INTERVAL_HOURS the background task dumps every table to timestamped
CSV files and bundles them into a single .zip under BACKUP_DIR, then prunes old
archives beyond BACKUP_RETENTION. Implemented in pure Python (via SQLAlchemy) so
it does not depend on `pg_dump`/`psql` being installed on the host.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401  (register all tables on Base.metadata)

log = logging.getLogger("backup")

# Columns we never write to a backup file (secrets that shouldn't sit in CSV).
_SKIP_COLUMNS = {"hashed_password"}


def _backup_dir() -> Path:
    d = Path(settings.BACKUP_DIR)
    if not d.is_absolute():
        # resolve relative to the repo root (app/services/backup.py -> parents[3])
        d = Path(__file__).resolve().parents[3] / settings.BACKUP_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


async def create_backup() -> Path:
    """Dump all tables to CSV and bundle into one timestamped .zip. Returns its path."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out = _backup_dir() / f"backup_{ts}.zip"

    async with engine.connect() as conn:
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
            for table in Base.metadata.sorted_tables:
                cols = [c.name for c in table.columns if c.name not in _SKIP_COLUMNS]
                if not cols:
                    continue
                res = await conn.execute(text(f'SELECT {", ".join(cols)} FROM {table.name}'))
                rows = res.fetchall()
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(cols)
                for r in rows:
                    writer.writerow(["" if v is None else v for v in r])
                zf.writestr(f"{table.name}.csv", buf.getvalue())
    log.info("backup: wrote %s", out.name)
    return out


def _prune(retention: int) -> None:
    files = sorted(_backup_dir().glob("backup_*.zip"))
    for old in files[:-retention] if retention > 0 else []:
        try:
            old.unlink()
            log.info("backup: pruned %s", old.name)
        except OSError:
            pass


async def run_backup() -> None:
    """Long-running loop: back up on startup, then every BACKUP_INTERVAL_HOURS."""
    if not settings.BACKUP_ENABLED:
        log.info("backup: disabled via settings")
        return
    interval = max(0.1, settings.BACKUP_INTERVAL_HOURS) * 3600
    log.info("backup: started (every %.1fh, keep %d)",
             settings.BACKUP_INTERVAL_HOURS, settings.BACKUP_RETENTION)
    while True:
        try:
            await create_backup()
            _prune(settings.BACKUP_RETENTION)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("backup: failed")
        await asyncio.sleep(interval)
