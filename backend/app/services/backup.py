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
import json
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, text, JSON

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401  (register all tables on Base.metadata)

log = logging.getLogger("backup")

# Columns we never write to a backup file (secrets that shouldn't sit in CSV).
_SKIP_COLUMNS = {"hashed_password"}
# Tables left untouched by restore: users (password hashes aren't in the backup)
# and alembic's bookkeeping.
_RESTORE_SKIP_TABLES = {"users", "alembic_version"}


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
                # Core SELECT over trusted schema columns — no raw SQL string.
                # (Identifiers come from the app's own metadata, never user input.)
                res = await conn.execute(select(*(table.c[name] for name in cols)))
                rows = res.fetchall()
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(cols)
                for r in rows:
                    writer.writerow(["" if v is None else v for v in r])
                zf.writestr(f"{table.name}.csv", buf.getvalue())
    log.info("backup: wrote %s", out.name)
    return out


def _coerce(table, row: dict) -> dict:
    """Turn CSV strings back into typed values for the given table's columns."""
    out: dict = {}
    for col in table.columns:
        if col.name not in row:
            continue
        v = row[col.name]
        if v == "" or v is None:
            out[col.name] = None
            continue
        if isinstance(col.type, JSON):
            try:
                out[col.name] = json.loads(v)
            except Exception:
                out[col.name] = None
            continue
        try:
            pyt = col.type.python_type
        except Exception:
            pyt = str
        try:
            if pyt is bool:
                out[col.name] = str(v).strip().lower() in ("true", "t", "1", "yes")
            elif pyt is int:
                out[col.name] = int(v)
            elif pyt is datetime:
                out[col.name] = datetime.fromisoformat(v)
            else:
                out[col.name] = v
        except Exception:
            out[col.name] = v
    return out


async def restore_backup(zip_bytes: bytes) -> dict:
    """Replace all data tables from the CSVs in an uploaded backup zip.

    DESTRUCTIVE: wipes and reloads every table found in the archive except
    `users` (whose password hashes aren't in backups) and `alembic_version`.
    Runs in one transaction, so a failure rolls everything back.
    """
    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    names = set(zf.namelist())
    summary: dict[str, int] = {}
    # second-pass updates for self-referential FK columns (e.g. towers.parent_id),
    # which can point at a row inserted later in the same table.
    deferred: list[tuple] = []   # (table, id_value, {col: value})

    def _self_ref_cols(table) -> set[str]:
        return {c.name for c in table.columns
                if any(fk.column.table is table for fk in c.foreign_keys)}

    async with engine.begin() as conn:   # single transaction — all-or-nothing
        # delete children first (reverse FK order)
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in _RESTORE_SKIP_TABLES:
                continue
            if f"{table.name}.csv" in names:
                await conn.execute(table.delete())
        # insert parents first (FK order)
        for table in Base.metadata.sorted_tables:
            if table.name in _RESTORE_SKIP_TABLES:
                continue
            csvname = f"{table.name}.csv"
            if csvname not in names:
                continue
            self_cols = _self_ref_cols(table)
            text_data = zf.read(csvname).decode("utf-8")
            reader = csv.DictReader(io.StringIO(text_data))
            rows = []
            for raw in reader:
                row = _coerce(table, raw)
                # null out self-references now; re-apply them after all inserts
                upd = {c: row[c] for c in self_cols if row.get(c) is not None}
                if upd and row.get("id") is not None:
                    deferred.append((table, row["id"], upd))
                    for c in self_cols:
                        row[c] = None
                rows.append(row)
            if rows:
                await conn.execute(table.insert(), rows)
            summary[table.name] = len(rows)
            if "id" in table.columns:
                # Raw SQL is unavoidable here (setval/sequence + MAX over a
                # dynamic table). Safe: `table.name` is a trusted schema
                # identifier from Base.metadata, never user input.
                await conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table.name}), 1))"
                ))
        # second pass: restore self-referential links now that all rows exist
        for table, id_value, upd in deferred:
            await conn.execute(table.update().where(table.c.id == id_value).values(**upd))
    log.info("restore: reloaded %s", summary)
    return summary


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
