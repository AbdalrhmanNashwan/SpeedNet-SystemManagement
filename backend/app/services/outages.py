"""Durable outage recording.

Runs off the same sweep results as the alert engine, but is deliberately
independent of it: alerting is throttled on purpose (cooldowns, the
mass-outage freeze, ALERT_ENABLED) and using those same gates here would punch
holes in the history. Alerts decide what's worth *telling someone*; this
decides what actually *happened*.

An outage row is opened once an IP has been down for OUTAGE_FAIL_THRESHOLD
consecutive sweeps and closed once it's been up for OUTAGE_RECOVER_THRESHOLD,
so a single dropped ping doesn't manufacture a fake outage.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.outage import OutageEvent
from app.models.meta import AppMeta

log = logging.getLogger("monitor.outages")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ref_of(result: dict) -> tuple[int | None, str | None, str | None]:
    """Best tower/label attribution for an IP, from its monitor refs."""
    for ref in (result.get("refs") or []):
        if ref.get("tower_id") is not None:
            return ref.get("tower_id"), ref.get("tower"), ref.get("label")
    refs = result.get("refs") or []
    return None, None, (refs[0].get("label") if refs else None)


class OutageRecorder:
    def __init__(self) -> None:
        self._down: dict[str, int] = {}
        self._up: dict[str, int] = {}
        # ip -> id of the still-open outage row
        self._open: dict[str, int] = {}
        self._loaded = False

    async def _load_open(self) -> None:
        """Rebuild in-memory state from the DB.

        Process memory resets on restart but the table doesn't, so without this
        a restart during an outage would orphan the open row forever (it would
        never be closed) and then open a duplicate on the next failure.

        Also records monitoring_since the first time we ever run, so uptime is
        measured against time we've actually observed.
        """
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(OutageEvent.ip, OutageEvent.id)
                .where(OutageEvent.ended_at.is_(None))
            )).all()
            self._open = {ip: rid for ip, rid in rows}
            existing = await db.get(AppMeta, "monitoring_since")
            if existing is None:
                db.add(AppMeta(key="monitoring_since", value=_now().isoformat()))
                await db.commit()
        self._loaded = True
        if self._open:
            log.info("outages: resumed %d open outage(s)", len(self._open))

    async def process_sweep(self, results: dict[str, dict]) -> None:
        try:
            if not self._loaded:
                await self._load_open()
            await self._process(results)
        except Exception:                    # never let recording break the loop
            log.exception("outages: process_sweep failed")

    async def _process(self, results: dict[str, dict]) -> None:
        known = {ip: r for ip, r in results.items() if r.get("status") in ("up", "down")}
        if not known:
            return

        to_open: list[tuple[str, dict]] = []
        to_close: list[int] = []

        for ip, r in known.items():
            if r["status"] == "down":
                self._down[ip] = self._down.get(ip, 0) + 1
                self._up[ip] = 0
                if (self._down[ip] >= settings.OUTAGE_FAIL_THRESHOLD
                        and ip not in self._open):
                    to_open.append((ip, r))
            else:
                self._up[ip] = self._up.get(ip, 0) + 1
                self._down[ip] = 0
                if (self._up[ip] >= settings.OUTAGE_RECOVER_THRESHOLD
                        and ip in self._open):
                    to_close.append(self._open.pop(ip))

        if not to_open and not to_close:
            return

        now = _now()
        async with AsyncSessionLocal() as db:
            for ip, r in to_open:
                tower_id, tower_name, label = _ref_of(r)
                row = OutageEvent(ip=ip, tower_id=tower_id, tower_name=tower_name,
                                  label=label, started_at=now)
                db.add(row)
                await db.flush()
                self._open[ip] = row.id
            if to_close:
                # Duration is derived from the stored start, not from a sweep
                # counter, so an outage spanning a restart still measures true.
                closing = (await db.execute(
                    select(OutageEvent).where(OutageEvent.id.in_(to_close))
                )).scalars().all()
                for o in closing:
                    o.ended_at = now
                    o.duration_seconds = int((now - o.started_at).total_seconds())
            await db.commit()
        if to_open:
            log.info("outages: opened %d", len(to_open))
        if to_close:
            log.info("outages: closed %d", len(to_close))


recorder = OutageRecorder()
