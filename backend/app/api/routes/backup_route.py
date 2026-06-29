"""Backup management — admin only. List / trigger / download / restore archives."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse

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
    return {"dir": str(d), "count": len(items), "backups": items}


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
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Restore failed: {exc}")
    await audit.log(db, admin, "restore", "backup", None,
                    {"file": file.filename, "rows": summary})
    return {"restored": summary}


@router.get("/{name}")
async def download_backup(name: str, admin: User = Depends(require_role("admin"))):
    """Download a specific archive (name must match backup_*.zip)."""
    if not name.startswith("backup_") or not name.endswith(".zip") or "/" in name or "\\" in name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid backup name")
    path = backup._backup_dir() / name
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup not found")
    return FileResponse(path, media_type="application/zip", filename=name)
