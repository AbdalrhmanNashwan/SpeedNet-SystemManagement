"""User management — admin only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.core.security import hash_password
from app.crud import audit
from app.models.user import User
from app.schemas.auth import UserOut, UserCreate
from pydantic import BaseModel, Field

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"viewer", "agent", "editor", "admin"}

# The permanent owner account. It can never have its admin access revoked, be
# deactivated, or be deleted, and only the owner themselves may edit it — not even
# another admin. This is the super-admin safety net. Compared case-insensitively.
OWNER_EMAIL = "abdalrhmannash.dev@gmail.com"


def _is_owner(email: str | None) -> bool:
    return (email or "").strip().lower() == OWNER_EMAIL


def _check_role(role: str | None):
    if role is not None and role not in VALID_ROLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Invalid role '{role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    zone_id: int | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    can_create: bool | None = None
    can_update: bool | None = None
    can_delete: bool | None = None


@router.get("", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), admin: User = Depends(require_role("admin"))):
    res = await db.execute(select(User))
    return list(res.scalars().all())


@router.post("", response_model=UserOut, status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db),
                      admin: User = Depends(require_role("admin"))):
    _check_role(data.role)
    exists = await db.execute(select(User).where(User.email == data.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=data.email, full_name=data.full_name, role=data.role,
                zone_id=data.zone_id, hashed_password=hash_password(data.password),
                can_create=data.can_create, can_update=data.can_update,
                can_delete=data.can_delete)
    db.add(user); await db.commit(); await db.refresh(user)
    await audit.log(db, admin, "create", "user", user.id, {"email": data.email, "role": data.role})
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db),
                      admin: User = Depends(require_role("admin"))):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    _check_role(data.role)
    # Protect the owner account: only the owner may edit it, and even they can't
    # strip its admin role or deactivate it.
    if _is_owner(user.email):
        if not _is_owner(admin.email):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "The owner account is protected and cannot be modified by other users.",
            )
        if (data.role is not None and data.role != "admin") or data.is_active is False:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "The owner account must remain an active admin.",
            )
    # don't let the last admin demote or deactivate themselves out of access
    if user.id == admin.id and (
        (data.role is not None and data.role != "admin") or data.is_active is False
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove your own admin access")
    patch = data.model_dump(exclude_unset=True)
    if "password" in patch:
        user.hashed_password = hash_password(patch.pop("password"))
        user.token_version += 1            # force re-login after a password change
    if patch.get("is_active") is False:
        user.token_version += 1            # kill sessions when deactivating
    for k, v in patch.items():
        setattr(user, k, v)
    await db.commit(); await db.refresh(user)
    await audit.log(db, admin, "update", "user", user_id, {k: v for k, v in patch.items() if k != "password"})
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db),
                      admin: User = Depends(require_role("admin"))):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if _is_owner(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "The owner account is protected and cannot be deleted.")
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete yourself")
    await audit.log(db, admin, "delete", "user", user_id, {"email": user.email})
    await db.delete(user); await db.commit()
