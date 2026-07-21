"""Tower CRUD — the reference example for all other entity routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_capability, ROLE_LEVEL
from app.crud.base import CRUDBase
from app.crud import audit
from app.models.tower import Tower
from app.models.user import User
from app.schemas.tower import TowerCreate, TowerUpdate, TowerOut

router = APIRouter(prefix="/towers", tags=["towers"])
crud = CRUDBase(Tower)

# Credential fields that read-only viewers must not receive (mirrors the
# devices route). Below "agent" level = viewer.
_SECRET_FIELDS = ("admin_pass",)


def _redact_for(user: User, out: TowerOut) -> TowerOut:
    """Blank out tower credentials for read-only viewers (< agent)."""
    if ROLE_LEVEL.get(user.role, 0) < ROLE_LEVEL["agent"]:
        for f in _SECRET_FIELDS:
            setattr(out, f, None)
    return out


def _check_scope(user: User, tower: Tower):
    """Agents may only touch towers in their zone. An agent with no zone
    assigned has no scope at all — deny, don't fall through to "everything".
    Returns 404 (not 403) so an out-of-zone agent can't use the response to
    confirm a tower exists in another zone (no cross-zone existence oracle)."""
    if user.role == "agent" and (user.zone_id is None or tower.zone_id != user.zone_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")


@router.get("", response_model=list[TowerOut])
async def list_towers(zone_id: int | None = None, area: str | None = None,
                      reseller: str | None = None, status_: str | None = None,
                      db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    # agents are scoped to their own zone (read + write); an agent with no
    # zone assigned sees nothing (crud.list skips None filters, so guard here)
    if user.role == "agent":
        if user.zone_id is None:
            return []
        zone_id = user.zone_id
    rows = await crud.list(db, zone_id=zone_id, area=area, reseller=reseller, status=status_)
    return [_redact_for(user, TowerOut.model_validate(t)) for t in rows]


@router.get("/{tower_id}", response_model=TowerOut)
async def get_tower(tower_id: int, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    return _redact_for(user, TowerOut.model_validate(obj))


@router.post("", response_model=TowerOut, status_code=201)
async def create_tower(data: TowerCreate, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_capability("create"))):
    payload = data.model_dump()
    # an agent may only create towers inside their own zone
    if user.role == "agent":
        if user.zone_id is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Outside your zone")
        if payload.get("zone_id") not in (None, user.zone_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Outside your zone")
        payload["zone_id"] = user.zone_id
    obj = await crud.create(db, payload)
    await audit.log(db, user, "create", "tower", obj.id, payload)
    return obj


@router.patch("/{tower_id}", response_model=TowerOut)
async def update_tower(tower_id: int, data: TowerUpdate, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_capability("update"))):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    changes = data.model_dump(exclude_unset=True)
    # an agent must not move a tower out of their own zone
    if user.role == "agent" and "zone_id" in changes and changes["zone_id"] != user.zone_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Can't reassign a tower's zone")
    delta = audit.diff(obj, changes)          # before/after — capture before mutating
    obj = await crud.update(db, obj, changes)
    await audit.log(db, user, "update", "tower", obj.id, delta)
    return obj


@router.delete("/{tower_id}", status_code=204)
async def delete_tower(tower_id: int, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_capability("delete"))):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    await audit.log(db, user, "delete", "tower", tower_id, {"name": obj.name})
    await crud.delete(db, obj)
