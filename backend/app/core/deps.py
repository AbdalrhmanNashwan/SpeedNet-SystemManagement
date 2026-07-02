"""FastAPI dependencies: DB session, auth, role guards."""
from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")

# role hierarchy: higher number = more power
ROLE_LEVEL = {"viewer": 1, "agent": 2, "editor": 3, "admin": 4}


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    # token_version mismatch ⇒ token was revoked (logout / password change / deactivate)
    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked")
    return user


def require_role(min_role: str):
    """Dependency factory: require at least `min_role`."""
    required = ROLE_LEVEL[min_role]

    async def _guard(user: User = Depends(get_current_user)) -> User:
        if ROLE_LEVEL.get(user.role, 0) < required:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires {min_role} role or higher",
            )
        return user

    return _guard


def require_capability(action: str, *, global_only: bool = False):
    """Dependency factory: require the per-user write capability for `action`.

    `action` is one of "create" | "update" | "delete". Admins always pass.
    Viewing is never gated here (reads don't use this). Agents keep their
    zone restriction on top — the route's own scope check still applies.

    `global_only=True` marks a company-wide resource (zones, IP allocations):
    an agent (zone-scoped) may never write those even with the flag set.
    """
    assert action in ("create", "update", "delete")

    async def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role == "admin":
            return user
        if global_only and user.role == "agent":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Agents are limited to their own zone",
            )
        if not getattr(user, f"can_{action}", False):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"You don't have permission to {action}",
            )
        return user

    return _guard


def require_global_view(user: User = Depends(get_current_user)) -> User:
    """Read access to a company-wide resource (e.g. IP allocations): any
    authenticated non-agent. Agents are zone-scoped and don't get the global
    registry."""
    if user.role == "agent":
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Agents are limited to their own zone")
    return user
