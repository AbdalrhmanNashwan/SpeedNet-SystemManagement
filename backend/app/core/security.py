"""Password hashing and JWT creation/verification."""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# Pre-computed hash used to spend the same ~bcrypt work when the submitted email
# doesn't exist, so login response timing can't be used to enumerate valid
# accounts (a real user with a wrong password does one bcrypt verify; without
# this, a missing user would return noticeably faster).
_DUMMY_HASH = pwd_context.hash("speednet-nonexistent-account-timing-guard")


def dummy_verify(plain: str) -> None:
    """Verify against a throwaway hash purely to equalize timing; ignores result."""
    try:
        pwd_context.verify(plain, _DUMMY_HASH)
    except Exception:
        pass


def _create_token(subject: str | int, role: str, expires: timedelta,
                  token_type: str, token_version: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": token_type,
        "tv": token_version,        # must match user.token_version to stay valid
        "iat": now,
        "exp": now + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int, role: str, token_version: int = 0) -> str:
    return _create_token(
        user_id, role,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access", token_version,
    )


def create_refresh_token(user_id: int, role: str, token_version: int = 0) -> str:
    return _create_token(
        user_id, role,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh", token_version,
    )


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
