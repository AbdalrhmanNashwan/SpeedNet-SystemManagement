"""Audit helper — call after every mutation."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User

# Substrings that mark a field as secret; its value is masked in the audit trail
# so device/credential passwords are not stored in plaintext alongside the log.
_SECRET_HINTS = ("pass", "secret", "unlock_code")


def _redact(changes: dict | None) -> dict | None:
    if not changes:
        return changes
    out = {}
    for k, v in changes.items():
        if v not in (None, "", [], {}) and any(h in k.lower() for h in _SECRET_HINTS):
            out[k] = "***"
        else:
            out[k] = v
    return out


async def log(db: AsyncSession, user: User, action: str, entity: str,
              entity_id: int | None, changes: dict | None = None) -> None:
    db.add(AuditLog(
        user_id=user.id, user_email=user.email,
        action=action, entity=entity, entity_id=entity_id, changes=_redact(changes),
    ))
    await db.commit()
