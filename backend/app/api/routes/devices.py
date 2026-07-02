"""Device CRUD for links/switches/sectors/servers + transfer between sections.

URL shape: /api/devices/{dtype}  where dtype in links|switches|sectors|servers
Transfer:  POST /api/devices/{dtype}/{id}/transfer
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (get_db, get_current_user, require_role,
                           require_capability, ROLE_LEVEL)
from app.crud import audit
from app.crud.device import MODEL_BY_TYPE, project_fields
from app.models.user import User
from app.models.tower import Tower
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceTransfer, DeviceOut

router = APIRouter(prefix="/devices", tags=["devices"])

# Credential fields that read-only viewers must not receive.
_SECRET_FIELDS = ("password", "wireless_pass", "unlock_code")


def _model_or_404(dtype: str):
    m = MODEL_BY_TYPE.get(dtype)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown device type '{dtype}'")
    return m


async def _agent_scope(db: AsyncSession, user: User, tower_id: int | None):
    if user.role != "agent":
        return
    # an agent with no zone assigned has no scope at all — deny everything
    if user.zone_id is None or tower_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Outside your zone")
    res = await db.execute(select(Tower).where(Tower.id == tower_id))
    tower = res.scalar_one_or_none()
    if not tower or tower.zone_id != user.zone_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Outside your zone")


@router.get("/{dtype}", response_model=list[DeviceOut])
async def list_devices(dtype: str, tower_id: int | None = None,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    model = _model_or_404(dtype)
    stmt = select(model)
    if tower_id is not None:
        stmt = stmt.where(model.tower_id == tower_id)
    # agents only see devices on towers within their zone; an agent with no
    # zone assigned sees nothing (== None would match zone-less towers)
    if user.role == "agent":
        if user.zone_id is None:
            return []
        stmt = stmt.join(Tower, Tower.id == model.tower_id).where(Tower.zone_id == user.zone_id)
    res = await db.execute(stmt)
    items = [DeviceOut.model_validate(r) for r in res.scalars().all()]
    # viewers are read-only and must not see device credentials
    if ROLE_LEVEL.get(user.role, 0) < ROLE_LEVEL["agent"]:
        for it in items:
            for f in _SECRET_FIELDS:
                setattr(it, f, None)
    return items


@router.post("/{dtype}", response_model=DeviceOut, status_code=201)
async def create_device(dtype: str, data: DeviceCreate, db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_capability("create"))):
    model = _model_or_404(dtype)
    await _agent_scope(db, user, data.tower_id)
    fields = project_fields(data.model_dump(), dtype)
    fields["tower_id"] = data.tower_id
    obj = model(**fields)
    db.add(obj); await db.commit(); await db.refresh(obj)
    await audit.log(db, user, "create", dtype, obj.id, fields)
    return obj


@router.patch("/{dtype}/{id}", response_model=DeviceOut)
async def update_device(dtype: str, id: int, data: DeviceUpdate,
                        db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_capability("update"))):
    model = _model_or_404(dtype)
    res = await db.execute(select(model).where(model.id == id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    await _agent_scope(db, user, obj.tower_id)
    changes = project_fields(data.model_dump(exclude_unset=True), dtype)
    if "tower_id" in data.model_dump(exclude_unset=True):  # allow moving tower
        await _agent_scope(db, user, data.tower_id)  # destination must also be in scope
        changes["tower_id"] = data.tower_id
    for k, v in changes.items():
        setattr(obj, k, v)
    await db.commit(); await db.refresh(obj)
    await audit.log(db, user, "update", dtype, id, changes)
    return obj


@router.delete("/{dtype}/{id}", status_code=204)
async def delete_device(dtype: str, id: int, db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_capability("delete"))):
    model = _model_or_404(dtype)
    res = await db.execute(select(model).where(model.id == id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    await _agent_scope(db, user, obj.tower_id)
    await audit.log(db, user, "delete", dtype, id, {"ip": getattr(obj, "ip", None)})
    await db.delete(obj); await db.commit()


@router.post("/{dtype}/{id}/transfer", response_model=DeviceOut)
async def transfer_device(dtype: str, id: int, body: DeviceTransfer,
                          db: AsyncSession = Depends(get_db),
                          user: User = Depends(require_capability("update"))):
    """Move a device to another section (type) and/or another tower."""
    src_model = _model_or_404(dtype)
    res = await db.execute(select(src_model).where(src_model.id == id))
    src = res.scalar_one_or_none()
    if not src:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    await _agent_scope(db, user, src.tower_id)

    target_type = body.to_type or dtype
    target_model = _model_or_404(target_type)
    target_tower = body.to_tower_id or src.tower_id
    # an agent must keep the device inside their own zone (source AND destination)
    await _agent_scope(db, user, target_tower)

    # snapshot source columns into a dict
    src_data = {c.name: getattr(src, c.name) for c in src.__table__.columns
                if c.name not in ("id", "created_at", "updated_at")}
    src_data["tower_id"] = target_tower
    fields = project_fields(src_data, target_type)
    fields["tower_id"] = target_tower

    if target_type == dtype:
        # same section — just (re)assign the tower in place; no delete/recreate
        src.tower_id = target_tower
        await db.commit(); await db.refresh(src)
        await audit.log(db, user, "transfer", dtype, id,
                        {"to_tower_id": target_tower})
        return src

    # different type: create in target, delete source
    new_obj = target_model(**fields)
    db.add(new_obj)
    await db.delete(src)
    await db.commit(); await db.refresh(new_obj)
    await audit.log(db, user, "transfer", dtype, id,
                    {"to_type": target_type, "to_tower_id": target_tower, "new_id": new_obj.id})
    return new_obj
