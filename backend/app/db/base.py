"""Declarative base. Models import THIS; nothing is imported back here
to avoid circular imports. Alembic discovers models via app/models/__init__.py."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
