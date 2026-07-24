"""Import all models so SQLAlchemy's mapper registry + Alembic see them."""
from app.models.zone import Zone
from app.models.tower import Tower
from app.models.device import Link, Switch, Sector, Server
from app.models.misc import IPAllocation, BackboneFeed, RoutingPoint, Subscriber
from app.models.user import User
from app.models.audit import AuditLog
from app.models.outage import OutageEvent
from app.models.meta import AppMeta

__all__ = ["Zone", "Tower", "Link", "Switch", "Sector", "Server",
           "IPAllocation", "BackboneFeed", "RoutingPoint", "Subscriber",
           "User", "AuditLog", "OutageEvent", "AppMeta"]
