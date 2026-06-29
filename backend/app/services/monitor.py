"""Background IP monitor.

Continuously pings every IP found across the device tables and keeps the latest
up/down status in an in-memory cache. The API never pings on request — it only
reads this cache — so the frontend can poll cheaply while a single background
task does the (bounded, batched) work.

Design notes / "manage the load":
  * One background task per process, started on app startup (see app.main).
  * IPs are pinged in batches of MONITOR_CONCURRENCY, using a single raw ICMP
    socket per batch via icmplib.async_multiping (far cheaper than spawning a
    `ping` process per host).
  * After a full sweep the task sleeps MONITOR_CYCLE_GAP, then sweeps again, so
    a modest server is never saturated regardless of how many IPs exist.
  * The IP list is re-read from the DB every MONITOR_REFRESH_IPS seconds, so
    edits/additions are picked up without a restart.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.device import Link, Switch, Sector
from app.models.misc import IPAllocation, RoutingPoint, BackboneFeed

log = logging.getLogger("monitor")

# Device tables whose rows can be deep-linked from the monitor:
#   (Model, ip_column, human_label, frontend_device_type)
# `frontend_device_type` matches the route /tower/{id}?focus=<type>:<device_id>.
_DEVICE_SOURCES = [
    (Link, Link.ip, "P2P link", "links"),
    (Switch, Switch.ip, "Switch", "switches"),
    (Sector, Sector.ip, "Sector", "sectors"),
]

# IP-allocation columns — deep-linkable to the IP Allocations page by row id
# (type "ip_allocation" → /ip-allocations?focus=<id>).
_ALLOC_SOURCES = [
    (IPAllocation.ip_master, "IP master"),
    (IPAllocation.ip_slave, "IP slave"),
    (IPAllocation.sw_ip, "IP switch"),
]

# Other places an IP lives, with no UI row to focus (label only):
#   (ip_column, human_label)
_OTHER_SOURCES = [
    (RoutingPoint.ip_gateway, "Routing gateway"),
    (RoutingPoint.ip_master, "Routing master"),
    (RoutingPoint.ip_slave, "Routing slave"),
    (BackboneFeed.switch_ip, "Backbone switch"),
    (BackboneFeed.ip, "Backbone"),
]


def _labels(refs: list[dict]) -> list[str]:
    """Distinct human labels for an IP's references (for compact display)."""
    return sorted({r["label"] for r in refs})


def _parse_ip(raw: str | None) -> str | None:
    """Best-effort extraction of a single host IP from a messy text field.

    Handles values like '10.0.0.1', '10.0.0.1/24', '10.0.0.1:8728',
    '10.0.0.1 (master)'. Returns the normalized address string or None.
    """
    if not raw:
        return None
    token = raw.strip().split()[0] if raw.strip() else ""
    if not token:
        return None
    # strip CIDR mask
    if "/" in token:
        token = token.split("/", 1)[0]
    # try as-is first (covers IPv6 with colons)
    try:
        return str(ipaddress.ip_address(token))
    except ValueError:
        pass
    # maybe ipv4:port
    if ":" in token:
        head = token.rsplit(":", 1)[0]
        try:
            return str(ipaddress.ip_address(head))
        except ValueError:
            return None
    return None


class MonitorState:
    """In-memory store of the latest ping results, keyed by IP string."""

    def __init__(self) -> None:
        self.results: dict[str, dict] = {}       # ip -> result dict
        self.refs: dict[str, list[dict]] = {}    # ip -> [{label, tower_id, type, device_id}]
        self.cycle = 0
        self.sweep_started_at: str | None = None
        self.sweep_completed_at: str | None = None
        self.running = False
        self.enabled = settings.MONITOR_ENABLED
        self.error: str | None = None

    def snapshot(self) -> dict:
        results = sorted(self.results.values(), key=lambda r: r["ip"])
        up = sum(1 for r in results if r["status"] == "up")
        down = sum(1 for r in results if r["status"] == "down")
        unknown = len(results) - up - down
        return {
            "enabled": self.enabled,
            "running": self.running,
            "cycle": self.cycle,
            "total": len(results),
            "up": up,
            "down": down,
            "unknown": unknown,
            "sweep_started_at": self.sweep_started_at,
            "sweep_completed_at": self.sweep_completed_at,
            "error": self.error,
            "results": results,
        }


state = MonitorState()


async def _collect_ips() -> dict[str, list[dict]]:
    """Read every valid host IP from the DB with references back to its row(s)."""
    found: dict[str, list[dict]] = {}

    def add(ip: str, ref: dict) -> None:
        # de-dupe identical refs (same row + label)
        refs = found.setdefault(ip, [])
        if ref not in refs:
            refs.append(ref)

    async with AsyncSessionLocal() as db:
        # device rows — fully deep-linkable (tower_id + type + device_id)
        for Model, col, label, dtype in _DEVICE_SOURCES:
            try:
                res = await db.execute(select(Model.id, Model.tower_id, col))
            except Exception as exc:
                log.warning("monitor: failed reading %s: %s", label, exc)
                continue
            for row_id, tower_id, raw in res.all():
                ip = _parse_ip(raw)
                if ip:
                    add(ip, {"label": label, "tower_id": tower_id,
                             "type": dtype, "device_id": row_id})

        # IP-allocation rows — deep-linkable to the IP Allocations page by id
        for col, label in _ALLOC_SOURCES:
            try:
                res = await db.execute(select(IPAllocation.id, IPAllocation.tower_id, col))
            except Exception as exc:
                log.warning("monitor: failed reading %s: %s", label, exc)
                continue
            for row_id, tower_id, raw in res.all():
                ip = _parse_ip(raw)
                if ip:
                    add(ip, {"label": label, "tower_id": tower_id,
                             "type": "ip_allocation", "device_id": row_id})

        # other rows — no focusable UI row (label only)
        for col, label in _OTHER_SOURCES:
            try:
                res = await db.execute(select(col).distinct())
            except Exception as exc:
                log.warning("monitor: failed reading %s: %s", label, exc)
                continue
            for (raw,) in res.all():
                ip = _parse_ip(raw)
                if ip:
                    add(ip, {"label": label, "tower_id": None,
                             "type": None, "device_id": None})
    return found


async def _ping_batch(addresses: list[str]) -> None:
    """Ping a batch of addresses and merge results into the state cache."""
    from icmplib import async_multiping  # imported lazily so a missing dep
                                          # only disables the monitor, not the app

    hosts = await async_multiping(
        addresses,
        count=settings.MONITOR_COUNT,
        timeout=settings.MONITOR_TIMEOUT,
        concurrent_tasks=settings.MONITOR_CONCURRENCY,
        privileged=settings.MONITOR_PRIVILEGED,
    )
    now = datetime.now(timezone.utc).isoformat()
    for host in hosts:
        ip = host.address
        refs = state.refs.get(ip, [])
        state.results[ip] = {
            "ip": ip,
            "status": "up" if host.is_alive else "down",
            "latency_ms": round(host.avg_rtt, 1) if host.is_alive else None,
            "packet_loss": host.packet_loss,
            "last_checked": now,
            "sources": _labels(refs),
            "refs": refs,
        }


async def check_ip(raw: str) -> dict | None:
    """Ping a single IP right now and merge the result into the cache.

    Used by the on-demand "force re-check" button. Returns the result dict, or
    None if `raw` isn't a usable IP.
    """
    ip = _parse_ip(raw) or raw
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        return None
    from icmplib import async_ping

    host = await async_ping(
        ip,
        count=settings.MONITOR_COUNT,
        timeout=settings.MONITOR_TIMEOUT,
        privileged=settings.MONITOR_PRIVILEGED,
    )
    refs = state.refs.get(ip) or state.results.get(ip, {}).get("refs", [])
    result = {
        "ip": ip,
        "status": "up" if host.is_alive else "down",
        "latency_ms": round(host.avg_rtt, 1) if host.is_alive else None,
        "packet_loss": host.packet_loss,
        "last_checked": datetime.now(timezone.utc).isoformat(),
        "sources": _labels(refs),
        "refs": refs,
    }
    state.results[ip] = result
    return result


async def _sweep() -> None:
    """One full pass over all known IPs, in concurrency-bounded batches."""
    ips = list(state.refs.keys())
    state.sweep_started_at = datetime.now(timezone.utc).isoformat()
    batch = max(1, settings.MONITOR_CONCURRENCY)
    for i in range(0, len(ips), batch):
        await _ping_batch(ips[i:i + batch])
    # drop cached results for IPs that no longer exist in the DB
    stale = set(state.results) - set(state.refs)
    for ip in stale:
        state.results.pop(ip, None)
    state.sweep_completed_at = datetime.now(timezone.utc).isoformat()
    state.cycle += 1


async def run_monitor() -> None:
    """Long-running loop: refresh IP list periodically, sweep, sleep, repeat."""
    if not settings.MONITOR_ENABLED:
        log.info("monitor: disabled via settings")
        return
    state.running = True
    last_refresh = 0.0
    log.info("monitor: started")
    try:
        while True:
            try:
                if time.monotonic() - last_refresh >= settings.MONITOR_REFRESH_IPS:
                    state.refs = await _collect_ips()
                    last_refresh = time.monotonic()
                    log.info("monitor: tracking %d IPs", len(state.refs))
                if state.refs:
                    await _sweep()
                    state.error = None
                else:
                    await asyncio.sleep(settings.MONITOR_CYCLE_GAP)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # never let the loop die
                state.error = str(exc)
                log.exception("monitor: sweep failed")
            await asyncio.sleep(settings.MONITOR_CYCLE_GAP)
    except asyncio.CancelledError:
        log.info("monitor: stopped")
        raise
    finally:
        state.running = False
