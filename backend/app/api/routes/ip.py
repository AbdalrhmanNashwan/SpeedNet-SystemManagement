"""IP allocation CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_capability
from app.crud.base import CRUDBase
from app.crud import audit
from app.models.misc import IPAllocation
from app.models.user import User
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/ip-allocations", tags=["ip"])
crud = CRUDBase(IPAllocation)


async def require_ip_access(user: User = Depends(get_current_user)) -> User:
    """Viewing IP allocations exposes master/slave/switch credentials, so it's
    not part of baseline "view". Allowed for admins and any non-agent user who
    has at least one write capability (i.e. an editor-tier account)."""
    if user.role == "admin":
        return user
    if user.role == "agent":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Agents are limited to their own zone")
    if not (user.can_create or user.can_update or user.can_delete):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "IP allocations require edit access")
    return user


class IPIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    owner: str | None = None
    point: str | None = None
    tower_ref: str | None = None
    tower_id: int | None = None
    link_type: str | None = None
    parent: str | None = None
    vlan: str | None = None
    ip_block: str | None = None
    ip_master: str | None = None
    user_master: str | None = None
    pass_master: str | None = None
    ip_slave: str | None = None
    user_slave: str | None = None
    pass_slave: str | None = None
    sw_ip: str | None = None
    sw_pass: str | None = None
    rs_pass: str | None = None
    note: str | None = None


class IPOut(IPIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


@router.get("", response_model=list[IPOut])
async def list_ip(db: AsyncSession = Depends(get_db), user: User = Depends(require_ip_access)):
    # IP allocations carry master/slave/switch credentials — see require_ip_access
    return await crud.list(db)


@router.post("", response_model=IPOut, status_code=201)
async def create_ip(data: IPIn, db: AsyncSession = Depends(get_db),
                    user: User = Depends(require_capability("create", global_only=True))):
    obj = await crud.create(db, data.model_dump())
    await audit.log(db, user, "create", "ip_allocation", obj.id, data.model_dump())
    return obj


@router.patch("/{ip_id}", response_model=IPOut)
async def update_ip(ip_id: int, data: IPIn, db: AsyncSession = Depends(get_db),
                    user: User = Depends(require_capability("update", global_only=True))):
    obj = await crud.get(db, ip_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    changes = data.model_dump(exclude_unset=True)
    delta = audit.diff(obj, changes)          # before/after — capture before mutating
    obj = await crud.update(db, obj, changes)
    await audit.log(db, user, "update", "ip_allocation", ip_id, delta)
    return obj


@router.delete("/{ip_id}", status_code=204)
async def delete_ip(ip_id: int, db: AsyncSession = Depends(get_db),
                    user: User = Depends(require_capability("delete", global_only=True))):
    obj = await crud.get(db, ip_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await audit.log(db, user, "delete", "ip_allocation", ip_id, None)
    await crud.delete(db, obj)
