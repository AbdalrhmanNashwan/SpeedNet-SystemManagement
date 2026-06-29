"""Auth routes: login, refresh, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.core.limiter import limiter
from app.core.security import (verify_password, create_access_token,
                               create_refresh_token, decode_token)
from app.models.user import User
from app.schemas.auth import Token, UserOut
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == form.username))
    user = res.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is inactive")
    return Token(
        access_token=create_access_token(user.id, user.role, user.token_version),
        refresh_token=create_refresh_token(user.id, user.role, user.token_version),
    )


@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
async def refresh(request: Request, body: RefreshIn, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    uid = int(payload["sub"])
    res = await db.execute(select(User).where(User.id == uid))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked")
    return Token(
        access_token=create_access_token(user.id, user.role, user.token_version),
        refresh_token=create_refresh_token(user.id, user.role, user.token_version),
    )


@router.post("/logout", status_code=204)
async def logout(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Revoke all of this user's existing tokens (access + refresh)."""
    user.token_version += 1
    await db.commit()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
