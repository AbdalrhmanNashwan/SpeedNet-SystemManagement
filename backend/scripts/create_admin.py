"""Seed an admin user. Run once after `alembic upgrade head`.

    python scripts/create_admin.py admin@example.com secretpassword

Defaults: admin@speednet.local / changeme
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password


_WEAK_PASSWORDS = {"changeme", "password", "admin", "admin123", "12345678"}


async def main(email: str = "admin@speednet.local", password: str = "changeme"):
    # Never create an admin with a weak/known password — this account is the
    # keys to the whole console.
    if len(password) < 8 or password.lower() in _WEAK_PASSWORDS:
        print("Refusing to create an admin with a weak/default password. "
              "Pass a strong one: python scripts/create_admin.py <email> <password>",
              file=sys.stderr)
        raise SystemExit(1)
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            print(f"User {email!r} already exists (id={existing.id}, role={existing.role}).")
            return
        user = User(
            email=email,
            full_name="Administrator",
            role="admin",
            hashed_password=hash_password(password),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Created admin user: {email!r} (id={user.id})")


if __name__ == "__main__":
    args = sys.argv[1:]
    email = args[0] if len(args) > 0 else "admin@speednet.local"
    password = args[1] if len(args) > 1 else "changeme"
    asyncio.run(main(email, password))
