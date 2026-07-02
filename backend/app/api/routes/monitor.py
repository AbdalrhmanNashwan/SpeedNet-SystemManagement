"""IP monitor endpoints — read the in-memory ping cache, or force a single check."""
from fastapi import APIRouter, Depends, HTTPException, status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.models.tower import Tower
from app.services import monitor


def _scope_events_for(user: User, events: list[dict], zone_of: dict[int, int | None]) -> list[dict]:
    """Restrict an agent to alerts relevant to their own zone.

    Non-agents (admin/editor/viewer) see every event. For an agent:
      * per-IP alerts (down / recovered) are shown ONLY when the IP belongs to a
        tower in their zone — an IP with no in-zone tower ref (backbone/routing
        infra, other zones) is NOT theirs and must not appear, and
      * genuinely network-wide events (mass_outage, which carry no per-IP refs)
        are shown to everyone.
    """
    if user.role != "agent":
        return events
    zid = user.zone_id
    scoped = []
    for ev in events:
        if ev.get("kind") == "mass_outage":
            scoped.append(ev)                       # network-wide → everyone
        elif _ip_in_agent_zone(ev.get("refs"), zid, zone_of):
            scoped.append(ev)                       # strictly in the agent's zone
    return scoped


def _ip_in_agent_zone(refs: list[dict] | None, zid: int | None,
                      zone_of: dict[int, int | None]) -> bool:
    """True if an IP (via its device refs) belongs to a tower in the agent's zone.

    Unlike alert scoping, this is STRICT: an IP with no tower ref at all
    (backbone / routing infra) is NOT visible to an agent — those aren't part
    of the zone they manage. This is what keeps an agent from seeing (or force-
    checking) every IP in the company.
    """
    if zid is None:
        # an unscoped agent has no zone — nothing matches (None == None would
        # otherwise leak every IP on zone-less towers)
        return False
    tower_ids = [r.get("tower_id") for r in (refs or [])
                 if r.get("tower_id") is not None]
    return any(zone_of.get(t) == zid for t in tower_ids)


async def _zone_of_towers(db: AsyncSession) -> dict[int, int | None]:
    rows = (await db.execute(select(Tower.id, Tower.zone_id))).all()
    return {tid: zid for tid, zid in rows}


router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.get("/status")
async def status(user: User = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    """Latest ping status for every tracked IP, plus a summary.

    Cheap: returns the cached snapshot built by the background monitor task.
    The frontend polls this every few seconds.

    An **agent** only sees IPs belonging to towers in their own zone; the
    summary counts are recomputed over that scoped subset. Admin/editor/viewer
    see the whole network.
    """
    snap = monitor.state.snapshot()
    if user.role == "agent":
        zone_of = await _zone_of_towers(db)
        zid = user.zone_id
        results = [r for r in snap["results"]
                   if _ip_in_agent_zone(r.get("refs"), zid, zone_of)]
        up = sum(1 for r in results if r["status"] == "up")
        down = sum(1 for r in results if r["status"] == "down")
        snap.update(results=results, total=len(results), up=up, down=down,
                    unknown=len(results) - up - down)
    return snap


@router.post("/check")
async def check(ip: str, user: User = Depends(get_current_user),
                db: AsyncSession = Depends(get_db)):
    """Ping one IP immediately and return its fresh result (also updates cache).

    Restricted to IPs already discovered from the database, so the endpoint
    can't be used to make the server probe arbitrary hosts. An **agent** may
    only re-check IPs that belong to a tower in their own zone.
    """
    from app.services.monitor import _parse_ip
    norm = _parse_ip(ip) or ip
    if norm not in monitor.state.refs and norm not in monitor.state.results:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "IP is not part of the monitored set")
    if user.role == "agent":
        refs = monitor.state.refs.get(norm) or monitor.state.results.get(norm, {}).get("refs", [])
        zone_of = await _zone_of_towers(db)
        if not _ip_in_agent_zone(refs, user.zone_id, zone_of):
            raise HTTPException(http.HTTP_403_FORBIDDEN, "IP is not in your zone")
    result = await monitor.check_ip(ip)
    if result is None:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, f"Not a valid IP: {ip}")
    return result


@router.get("/alerts")
async def alerts(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recent down/recovery/mass-outage alert events.

    Every role sees the feed, but an **agent** is scoped to their own zone —
    they only get alerts for towers in their zone (plus network-wide events).
    Admin/editor/viewer see everything.

    Also reports the active anti-spam config so the UI can show how alerting
    is tuned (thresholds, cooldown, channels).
    """
    from app.services.alerts import manager

    # Pull the full history first, scope it, *then* trim to `limit` — otherwise
    # an agent could get an empty page while in-zone alerts sit just past the cut.
    events = manager.recent(settings.ALERT_HISTORY_SIZE)
    if user.role == "agent":
        zone_of = await _zone_of_towers(db)
        events = _scope_events_for(user, events, zone_of)
    events = events[:min(limit, settings.ALERT_HISTORY_SIZE)]

    from datetime import datetime, timezone
    return {
        "enabled": settings.ALERT_ENABLED,
        # Server's current time, so the UI can correct for client clock skew
        # when rendering "x minutes ago" (don't trust the browser's clock).
        "now": datetime.now(timezone.utc).isoformat(),
        "config": {
            "fail_threshold": settings.ALERT_FAIL_THRESHOLD,
            "recover_threshold": settings.ALERT_RECOVER_THRESHOLD,
            "cooldown_minutes": settings.ALERT_COOLDOWN_MINUTES,
            "mass_outage_ratio": settings.ALERT_MASS_OUTAGE_RATIO,
            "mass_outage_min": settings.ALERT_MASS_OUTAGE_MIN,
            "webhook": bool(settings.ALERT_WEBHOOK_URL),
            "email": bool(settings.ALERT_SMTP_HOST and settings.ALERT_EMAIL_TO),
        },
        "events": events,
    }
