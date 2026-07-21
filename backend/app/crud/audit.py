"""Audit helper — call after every mutation."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User

# Substrings that mark a field as secret; its value is masked in the audit trail
# so device/credential passwords are not stored in plaintext alongside the log.
_SECRET_HINTS = ("pass", "secret", "unlock_code")


def _is_secret(key: str) -> bool:
    return any(h in key.lower() for h in _SECRET_HINTS)


def _mask(val):
    return "***" if val not in (None, "", [], {}) else val


def _redact(changes: dict | None) -> dict | None:
    if not changes:
        return changes
    out = {}
    for k, v in changes.items():
        secret = _is_secret(k)
        # before/after shape: {"from": old, "to": new} — mask both sides
        if isinstance(v, dict) and ("from" in v or "to" in v):
            out[k] = {side: (_mask(val) if secret else val) for side, val in v.items()}
        elif secret:
            out[k] = _mask(v)
        else:
            out[k] = v
    return out


def diff(before: object, changes: dict) -> dict:
    """Turn a patch dict into ``{field: {"from": old, "to": new}}`` for the
    History page, reading the object's *current* (pre-update) attributes for the
    old values. Only fields that actually change are kept. MUST be called before
    the object is mutated. Non-diff context keys can be merged in by the caller
    afterwards (they render as plain values)."""
    out: dict = {}
    for k, new in changes.items():
        old = getattr(before, k, None)
        if old != new:
            out[k] = {"from": old, "to": new}
    return out


async def log(db: AsyncSession, user: User, action: str, entity: str,
              entity_id: int | None, changes: dict | None = None) -> None:
    db.add(AuditLog(
        user_id=user.id, user_email=user.email,
        action=action, entity=entity, entity_id=entity_id, changes=_redact(changes),
    ))
    await db.commit()
