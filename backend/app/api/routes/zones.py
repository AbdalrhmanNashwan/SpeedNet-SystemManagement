"""Zone CRUD + recompute rule-based membership."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_capability
from app.crud.base import CRUDBase
from app.crud import audit
from app.models.zone import Zone
from app.models.tower import Tower
from app.models.user import User
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/zones", tags=["zones"])
crud = CRUDBase(Zone)


class ZoneIn(BaseModel):
    name: str
    tag: str | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int = 0
    rule_field: str | None = None   # 'reseller' | 'area' | None
    rule_value: str | None = None


class ZoneUpdate(BaseModel):
    # all optional so a PATCH only changes the fields actually sent
    name: str | None = None
    tag: str | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    rule_field: str | None = None
    rule_value: str | None = None


class ZoneOut(ZoneIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


@router.get("", response_model=list[ZoneOut])
async def list_zones(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    zones = await crud.list(db)
    # agents are zone-scoped: they only get their own zone, not the whole
    # company-wide list of zone names/rules.
    if user.role == "agent":
        zones = [z for z in zones if z.id == user.zone_id]
    return zones


@router.post("", response_model=ZoneOut, status_code=201)
async def create_zone(data: ZoneIn, db: AsyncSession = Depends(get_db),
                      user: User = Depends(require_capability("create", global_only=True))):
    obj = await crud.create(db, data.model_dump())
    await audit.log(db, user, "create", "zone", obj.id, data.model_dump())
    return obj


@router.patch("/{zone_id}", response_model=ZoneOut)
async def update_zone(zone_id: int, data: ZoneUpdate, db: AsyncSession = Depends(get_db),
                      user: User = Depends(require_capability("update", global_only=True))):
    obj = await crud.get(db, zone_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Zone not found")
    changes = data.model_dump(exclude_unset=True)
    delta = audit.diff(obj, changes)          # before/after — capture before mutating
    obj = await crud.update(db, obj, changes)
    await audit.log(db, user, "update", "zone", zone_id, delta)
    return obj


@router.delete("/{zone_id}", status_code=204)
async def delete_zone(zone_id: int, db: AsyncSession = Depends(get_db),
                      user: User = Depends(require_capability("delete", global_only=True))):
    obj = await crud.get(db, zone_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Zone not found")
    await audit.log(db, user, "delete", "zone", zone_id, {"name": obj.name})
    await crud.delete(db, obj)


@router.post("/{zone_id}/recompute", response_model=dict)
async def recompute_membership(zone_id: int, db: AsyncSession = Depends(get_db),
                               user: User = Depends(require_capability("update", global_only=True))):
    """Re-assign towers to this zone based on its rule (reseller/area = value)."""
    zone = await crud.get(db, zone_id)
    if not zone:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Zone not found")
    if not zone.rule_field or not zone.rule_value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Zone has no rule to apply")
    col = {"reseller": Tower.reseller, "area": Tower.area}.get(zone.rule_field)
    if col is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported rule_field")
    # clear current members, then set matching ones
    await db.execute(update(Tower).where(Tower.zone_id == zone_id).values(zone_id=None))
    res = await db.execute(update(Tower).where(col == zone.rule_value).values(zone_id=zone_id))
    await db.commit()
    await audit.log(db, user, "recompute", "zone", zone_id,
                    {"rule": f"{zone.rule_field}={zone.rule_value}"})
    return {"zone_id": zone_id, "matched": res.rowcount}
