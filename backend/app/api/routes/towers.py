"""Tower CRUD — the reference example for all other entity routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_role
from app.crud.base import CRUDBase
from app.crud import audit
from app.models.tower import Tower
from app.models.user import User
from app.schemas.tower import TowerCreate, TowerUpdate, TowerOut

router = APIRouter(prefix="/towers", tags=["towers"])
crud = CRUDBase(Tower)


def _check_scope(user: User, tower: Tower):
    """Agents may only touch towers in their zone."""
    if user.role == "agent" and tower.zone_id != user.zone_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Outside your zone")


@router.get("", response_model=list[TowerOut])
async def list_towers(zone_id: int | None = None, area: str | None = None,
                      reseller: str | None = None, status_: str | None = None,
                      db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    # agents are scoped to their own zone (read + write)
    if user.role == "agent":
        zone_id = user.zone_id
    return await crud.list(db, zone_id=zone_id, area=area, reseller=reseller, status=status_)


@router.get("/{tower_id}", response_model=TowerOut)
async def get_tower(tower_id: int, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    return obj


@router.post("", response_model=TowerOut, status_code=201)
async def create_tower(data: TowerCreate, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_role("editor"))):
    obj = await crud.create(db, data.model_dump())
    await audit.log(db, user, "create", "tower", obj.id, data.model_dump())
    return obj


@router.patch("/{tower_id}", response_model=TowerOut)
async def update_tower(tower_id: int, data: TowerUpdate, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_role("agent"))):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    changes = data.model_dump(exclude_unset=True)
    # an agent must not move a tower out of their own zone
    if user.role == "agent" and "zone_id" in changes and changes["zone_id"] != user.zone_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Can't reassign a tower's zone")
    obj = await crud.update(db, obj, changes)
    await audit.log(db, user, "update", "tower", obj.id, changes)
    return obj


@router.delete("/{tower_id}", status_code=204)
async def delete_tower(tower_id: int, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_role("editor"))):
    obj = await crud.get(db, tower_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tower not found")
    _check_scope(user, obj)
    await audit.log(db, user, "delete", "tower", tower_id, {"name": obj.name})
    await crud.delete(db, obj)
