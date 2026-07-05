"""Backup management — admin only. List / trigger / download / restore archives."""
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse

log = logging.getLogger("uvicorn.error")

from app.core.config import settings
from app.core.deps import require_role
from app.crud import audit
from app.core.deps import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.services import backup

router = APIRouter(prefix="/backups", tags=["backups"])


@router.get("")
async def list_backups(admin: User = Depends(require_role("admin"))):
    """Newest-first list of backup archives with size and timestamp."""
    d = backup._backup_dir()
    items = []
    for f in sorted(d.glob("backup_*.zip"), reverse=True):
        st = f.stat()
        items.append({"name": f.name, "size_bytes": st.st_size, "mtime": st.st_mtime})
    # Note: the absolute backup directory path is deliberately NOT returned —
    # no need to disclose server filesystem paths to the client.
    return {"count": len(items), "backups": items}


@router.post("/run")
async def run_backup_now(admin: User = Depends(require_role("admin"))):
    """Trigger an immediate backup and return the new archive's name."""
    path = await backup.create_backup()
    backup._prune(settings.BACKUP_RETENTION)
    return {"created": path.name}


@router.post("/restore")
async def restore_backup(confirm: bool = False,
                         file: UploadFile = File(...),
                         admin: User = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    """Restore all data tables from an uploaded backup .zip (DESTRUCTIVE).

    Wipes and reloads every table in the archive except `users`. Requires
    `?confirm=true` to guard against accidents.
    """
    if not confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Pass ?confirm=true — this replaces all current data")
    if not (file.filename or "").endswith(".zip"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload a backup .zip file")
    data = await file.read()
    try:
        summary = await backup.restore_backup(data)
    except Exception:
        # Full detail (which may include DB/schema/path internals) goes to the
        # server log only — the client gets a safe, generic message.
        log.exception("backup restore failed for %r", file.filename)
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Restore failed — the archive is invalid or corrupt")
    await audit.log(db, admin, "restore", "backup", None,
                    {"file": file.filename, "rows": summary})
    return {"restored": summary}


def _archive_or_error(name: str):
    """Validate an archive name (backup_*.zip, no path parts) and return its path."""
    if not name.startswith("backup_") or not name.endswith(".zip") or "/" in name or "\\" in name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid backup name")
    path = backup._backup_dir() / name
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup not found")
    return path


@router.get("/download")
async def download_backup_by_query(name: str, admin: User = Depends(require_role("admin"))):
    """Download an archive via ?name=... — the URL path carries no .zip suffix,
    which keeps ad/download-blocker browser extensions from eating the request
    (they blank out XHRs whose path ends in .zip). Registered before /{name}."""
    path = _archive_or_error(name)
    return FileResponse(path, media_type="application/zip", filename=name)


@router.get("/{name}")
async def download_backup(name: str, admin: User = Depends(require_role("admin"))):
    """Download a specific archive (name must match backup_*.zip)."""
    path = _archive_or_error(name)
    return FileResponse(path, media_type="application/zip", filename=name)
