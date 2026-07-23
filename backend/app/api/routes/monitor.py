"""IP monitor endpoints — read the in-memory ping cache, or force a single check."""
import time as _time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status as http
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.core.config import settings
from app.core.limiter import limiter
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


async def _agent_tower_ids(db: AsyncSession, user: User) -> list[int]:
    """Tower ids inside an agent's zone, for scoping history queries.

    An agent with no zone gets an empty list, which filters everything out —
    the same strict rule the live-status endpoints use. Returning [-1] rather
    than [] is unnecessary here: `IN ()` on an empty list is valid SQLAlchemy
    and evaluates to false.
    """
    if user.zone_id is None:
        return []
    rows = (await db.execute(
        select(Tower.id).where(Tower.zone_id == user.zone_id)
    )).scalars().all()
    return list(rows)


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
@limiter.limit("30/minute")
async def check(request: Request, ip: str, user: User = Depends(get_current_user),
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
            # 404 (not 403) so an out-of-zone agent can't tell whether the IP
            # exists elsewhere in the system — no cross-zone existence oracle.
            raise HTTPException(http.HTTP_404_NOT_FOUND, "IP is not part of the monitored set")
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
            "telegram": bool(settings.ALERT_TELEGRAM_BOT_TOKEN and settings.ALERT_TELEGRAM_CHAT_ID),
        },
        "events": events,
    }


@router.get("/outages")
async def outages(
    days: int = 30,
    limit: int = 200,
    ip: str | None = None,
    tower_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recorded outages, newest first. Agents see only their own zone.

    Ongoing outages have `ended_at: null` and are always included regardless of
    the window — an outage that started before the window but is still running
    is the most relevant row on the page.
    """
    from datetime import timedelta
    from sqlalchemy import or_
    from app.models.outage import OutageEvent

    since = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))
    q = select(OutageEvent).where(
        or_(OutageEvent.started_at >= since, OutageEvent.ended_at.is_(None))
    )
    if ip:
        q = q.where(OutageEvent.ip == ip)
    if tower_id is not None:
        q = q.where(OutageEvent.tower_id == tower_id)
    if user.role == "agent":
        q = q.where(OutageEvent.tower_id.in_(await _agent_tower_ids(db, user)))

    q = q.order_by(OutageEvent.started_at.desc()).limit(max(1, min(limit, 1000)))
    rows = (await db.execute(q)).scalars().all()
    now = datetime.now(timezone.utc)
    return {
        "now": now.isoformat(),
        "days": days,
        "outages": [
            {
                "id": o.id,
                "ip": o.ip,
                "tower_id": o.tower_id,
                "tower_name": o.tower_name,
                "label": o.label,
                "started_at": o.started_at.isoformat(),
                "ended_at": o.ended_at.isoformat() if o.ended_at else None,
                # Ongoing outages have no stored duration yet — compute the
                # running length so the UI doesn't have to special-case it.
                "duration_seconds": (
                    o.duration_seconds if o.ended_at
                    else int((now - o.started_at).total_seconds())
                ),
                "ongoing": o.ended_at is None,
            }
            for o in rows
        ],
    }


@router.get("/uptime")
async def uptime(
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-IP downtime totals over the window, worst first.

    Uptime % is measured against the window length, and outages are clipped to
    the window so one long outage that predates it can't push a figure below
    0%. Only IPs that actually had an outage appear — everything else was at
    100% by definition.
    """
    from datetime import timedelta
    from sqlalchemy import or_
    from app.models.outage import OutageEvent

    days = max(1, min(days, 365))
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    window = days * 86400.0

    q = select(OutageEvent).where(
        or_(OutageEvent.started_at >= since, OutageEvent.ended_at.is_(None),
            OutageEvent.ended_at >= since)
    )
    if user.role == "agent":
        q = q.where(OutageEvent.tower_id.in_(await _agent_tower_ids(db, user)))
    rows = (await db.execute(q)).scalars().all()

    agg: dict[str, dict] = {}
    for o in rows:
        start = max(o.started_at, since)
        end = min(o.ended_at or now, now)
        secs = max(0.0, (end - start).total_seconds())
        a = agg.setdefault(o.ip, {
            "ip": o.ip, "tower_id": o.tower_id, "tower_name": o.tower_name,
            "label": o.label, "outages": 0, "downtime_seconds": 0.0,
            "last_outage_at": None, "ongoing": False,
        })
        a["outages"] += 1
        a["downtime_seconds"] += secs
        a["ongoing"] = a["ongoing"] or o.ended_at is None
        iso = o.started_at.isoformat()
        if a["last_outage_at"] is None or iso > a["last_outage_at"]:
            a["last_outage_at"] = iso

    items = []
    for a in agg.values():
        a["downtime_seconds"] = int(a["downtime_seconds"])
        a["uptime_pct"] = round(max(0.0, 100.0 * (1 - a["downtime_seconds"] / window)), 4)
        items.append(a)
    items.sort(key=lambda x: x["downtime_seconds"], reverse=True)

    return {"now": now.isoformat(), "days": days, "window_seconds": int(window),
            "items": items}


@router.post("/alerts/test")
@limiter.limit("6/minute")
async def alerts_test(request: Request,
                      user: User = Depends(require_role("admin"))):
    """Send a test alert through every configured channel (admin only).

    Reports which channels are configured and, for Telegram, the last error —
    so a wrong bot token or a chat that never messaged the bot is visible here
    instead of looking like "the network is fine".
    """
    from app.services.alerts import manager
    return await manager.send_test(user.email)


# ---------------------------------------------------------------------------
# External agent ingest.
#
# When the app runs somewhere it cannot reach the private device IPs (a cloud
# host), an agent inside the network pings the devices and pushes results here.
# The endpoints are authenticated with a shared token (MONITOR_AGENT_TOKEN), not
# a user login, since the caller is a machine and not a person.
# ---------------------------------------------------------------------------
_refs_refreshed_at = 0.0


def _require_agent(token: str | None) -> None:
    if not settings.MONITOR_AGENT_TOKEN:
        raise HTTPException(http.HTTP_503_SERVICE_UNAVAILABLE,
                            "Agent ingest disabled (MONITOR_AGENT_TOKEN not set)")
    if not token or token != settings.MONITOR_AGENT_TOKEN:
        raise HTTPException(http.HTTP_401_UNAUTHORIZED, "Invalid agent token")


async def _ensure_refs(force: bool = False) -> None:
    """(Re)load the IP→refs map from the DB so ingested results carry sources
    and deep-links, and stale IPs get dropped. Cached for MONITOR_REFRESH_IPS."""
    global _refs_refreshed_at
    stale = _time.monotonic() - _refs_refreshed_at >= settings.MONITOR_REFRESH_IPS
    if force or stale or not monitor.state.refs:
        monitor.state.refs = await monitor._collect_ips()
        _refs_refreshed_at = _time.monotonic()


class AgentResult(BaseModel):
    ip: str
    is_alive: bool
    latency_ms: float | None = None
    packet_loss: float | None = None


class IngestBody(BaseModel):
    results: list[AgentResult]


@router.get("/targets")
async def targets(x_agent_token: str | None = Header(None, alias="X-Agent-Token")):
    """IP list the in-network agent should ping. Token-authenticated."""
    _require_agent(x_agent_token)
    await _ensure_refs(force=True)
    return {"ips": sorted(monitor.state.refs.keys())}


@router.post("/ingest")
async def ingest(body: IngestBody,
                 x_agent_token: str | None = Header(None, alias="X-Agent-Token")):
    """Receive ping results from the in-network agent and update the live cache
    that /monitor/status serves. Token-authenticated."""
    _require_agent(x_agent_token)
    await _ensure_refs()

    st = monitor.state
    now = datetime.now(timezone.utc).isoformat()
    for r in body.results:
        ip = monitor._parse_ip(r.ip) or r.ip
        refs = st.refs.get(ip, [])
        st.results[ip] = {
            "ip": ip,
            "status": "up" if r.is_alive else "down",
            "latency_ms": round(r.latency_ms, 1) if (r.is_alive and r.latency_ms is not None) else None,
            "packet_loss": r.packet_loss if r.packet_loss is not None else (0.0 if r.is_alive else 1.0),
            "last_checked": now,
            "down_since": monitor._down_since(ip, r.is_alive, now),
            "sources": monitor._labels(refs),
            "refs": refs,
        }
    # forget IPs that no longer exist in the DB
    for ip in set(st.results) - set(st.refs):
        st.results.pop(ip, None)

    st.enabled = True
    st.running = True
    st.sweep_started_at = st.sweep_started_at or now
    st.sweep_completed_at = now
    st.cycle += 1
    st.error = None

    if settings.OUTAGE_HISTORY_ENABLED:
        try:
            from app.services.outages import recorder
            await recorder.process_sweep(st.results)
        except Exception:  # never let recording break ingest
            pass

    if settings.ALERT_ENABLED:
        try:
            from app.services.alerts import manager as alert_manager
            await alert_manager.process_sweep(st.results)
        except Exception:  # never let alerting break ingest
            pass

    return {"accepted": len(body.results), "total": len(st.results)}
