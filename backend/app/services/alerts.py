"""Down-alert engine with built-in anti-spam.

The monitor calls `manager.process_sweep(results)` after every full sweep. This
module decides *whether* an alert is worth sending, then fans it out to the
configured channels (webhook / email). The hard part is NOT sending — it's
staying quiet, so three guards keep it from becoming noise:

  1. Sustained failure — an IP must be down ALERT_FAIL_THRESHOLD sweeps in a
     row before it is "confirmed down". A one-sweep blip never alerts.
  2. Edge-triggered + cooldown — we alert once on the ok→down edge and once on
     down→ok; a per-IP cooldown stops a flapping host from re-alerting.
  3. Mass-outage guard — if a big fraction of all tracked IPs are down in the
     same sweep, that's almost always the monitor's own uplink (or a reboot
     wave), so we send ONE aggregate alert and freeze per-IP state instead of
     blasting hundreds of messages — and the matching recovery storm too.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from collections import deque
from datetime import datetime, timezone
from email.message import EmailMessage

import httpx

from app.core.config import settings

log = logging.getLogger("monitor.alerts")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _tg_escape(s: str) -> str:
    """Escape the characters Telegram's HTML parse mode treats as markup."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _console_link(path: str) -> str | None:
    """Build an absolute link into the console UI, or None if no base URL is
    configured. `path` is an app route like "/tower/5" or "/monitor"; the
    /console basename is added here so callers don't have to know about it."""
    base = (settings.ALERT_LINK_BASE_URL or "").rstrip("/")
    if not base:
        return None
    return f"{base}/console{path}"


def _tower_names(refs: list[dict] | None) -> str:
    """Distinct tower names an IP belongs to, in ref order, comma-joined. Empty
    string when no ref carries a name (older refs, or IPs with no tower)."""
    seen: list[str] = []
    for ref in (refs or []):
        name = ref.get("tower")
        if name and name not in seen:
            seen.append(name)
    return ", ".join(seen)


def _link_for(extra: dict) -> str | None:
    """Pick the most useful deep link for an alert. Prefer the affected tower,
    and when we know which device the IP belongs to, add ?focus=<type>:<id> so
    the tower page scrolls to and highlights that exact row. Fall back to a
    search for the IP, then the live monitor page for network-wide events."""
    for ref in (extra.get("refs") or []):
        tid = ref.get("tower_id")
        if tid is not None:
            dtype, did = ref.get("type"), ref.get("device_id")
            if dtype and did is not None:
                # matches TowerDetail's ?focus=<type>:<deviceId> deep-link,
                # which highlights + scrolls the row into view.
                return _console_link(f"/tower/{tid}?focus={dtype}:{did}")
            return _console_link(f"/tower/{tid}")
    ip = extra.get("ip")
    if ip:
        return _console_link(f"/search?q={ip}")
    return _console_link("/monitor")


class _IpState:
    __slots__ = ("down_streak", "up_streak", "confirmed_down", "last_down_alert", "seen_up")

    def __init__(self) -> None:
        self.down_streak = 0
        self.up_streak = 0
        self.confirmed_down = False          # last *notified* state for this IP
        self.last_down_alert: datetime | None = None
        # Only alert on a real online->offline transition. An IP that has been
        # offline the whole time (e.g. already down at startup) is a silent
        # baseline until we've actually seen it up once.
        self.seen_up = False


class AlertManager:
    def __init__(self) -> None:
        self._ip: dict[str, _IpState] = {}
        self._mass_outage_active = False
        self._last_mass_alert: datetime | None = None
        self.events: deque[dict] = deque(maxlen=settings.ALERT_HISTORY_SIZE)

    # -- public API ---------------------------------------------------------
    async def process_sweep(self, results: dict[str, dict]) -> None:
        if not settings.ALERT_ENABLED:
            return
        try:
            await self._process(results)
        except Exception:                    # never let alerting break the loop
            log.exception("alerts: process_sweep failed")

    def recent(self, limit: int = 50) -> list[dict]:
        items = list(self.events)[-limit:]
        items.reverse()
        return items

    # -- core ---------------------------------------------------------------
    async def _process(self, results: dict[str, dict]) -> None:
        # only consider IPs with a definite up/down verdict this sweep
        known = {ip: r for ip, r in results.items() if r.get("status") in ("up", "down")}
        if not known:
            return
        down = {ip: r for ip, r in known.items() if r["status"] == "down"}

        # ---- guard 3: mass outage -> aggregate, don't storm ----
        is_mass = (
            len(known) >= settings.ALERT_MASS_OUTAGE_MIN
            and len(down) >= len(known) * settings.ALERT_MASS_OUTAGE_RATIO
        )
        if is_mass:
            if not self._mass_outage_active:
                self._mass_outage_active = True
                await self._emit_mass(len(down), len(known))
            # freeze per-IP streak bookkeeping so we don't fire a recovery
            # storm when the upstream link comes back.
            return
        if self._mass_outage_active:
            # mass event cleared — resync state silently, no recovery storm
            self._mass_outage_active = False
            for ip, r in known.items():
                st = self._ip.setdefault(ip, _IpState())
                st.confirmed_down = (r["status"] == "down")
                st.down_streak = 0
                st.up_streak = 0
                if r["status"] == "up":
                    st.seen_up = True
            return

        # ---- normal per-IP evaluation ----
        for ip, r in known.items():
            st = self._ip.setdefault(ip, _IpState())
            if r["status"] == "down":
                st.down_streak += 1
                st.up_streak = 0
                if not st.confirmed_down and st.down_streak >= settings.ALERT_FAIL_THRESHOLD:
                    # Only a genuine online->offline transition is worth an alert:
                    #   * seen_up  -> we actually watched it go from up to down
                    #   * cooldown -> not a flapping host inside its quiet window
                    # confirmed_down is latched ONLY when we truly alert, so a
                    # baseline-offline IP never produces a phantom recovery later.
                    if st.seen_up and self._cooldown_ok(st):
                        st.confirmed_down = True
                        st.last_down_alert = _now()
                        await self._emit_ip("down", ip, r)
            else:  # up
                st.up_streak += 1
                st.down_streak = 0
                st.seen_up = True
                if st.confirmed_down and st.up_streak >= settings.ALERT_RECOVER_THRESHOLD:
                    st.confirmed_down = False
                    await self._emit_ip("recovered", ip, r)

    def _cooldown_ok(self, st: _IpState) -> bool:
        if st.last_down_alert is None:
            return True
        mins = (_now() - st.last_down_alert).total_seconds() / 60.0
        return mins >= settings.ALERT_COOLDOWN_MINUTES

    # -- emit / record ------------------------------------------------------
    async def _emit_ip(self, kind: str, ip: str, r: dict) -> None:
        sources = ", ".join(r.get("sources") or []) or "unknown"
        towers = _tower_names(r.get("refs"))
        at = f" at {towers}" if towers else ""   # name the tower when we know it
        if kind == "down":
            title = f"🔴 DOWN: {ip}"
            body = f"{ip} is unreachable{at} ({sources}). Down for ≥ {settings.ALERT_FAIL_THRESHOLD} checks."
        else:
            title = f"🟢 RECOVERED: {ip}"
            body = f"{ip} is reachable again{at} ({sources})."
        await self._dispatch(kind, title, body, {"ip": ip, "sources": r.get("sources"), "refs": r.get("refs")})

    async def _emit_mass(self, down: int, total: int) -> None:
        # cooldown the aggregate too, so a sustained outage doesn't repeat
        if self._last_mass_alert and (_now() - self._last_mass_alert).total_seconds() / 60.0 < settings.ALERT_COOLDOWN_MINUTES:
            return
        self._last_mass_alert = _now()
        title = f"⚠️ MASS OUTAGE: {down}/{total} IPs down"
        body = (f"{down} of {total} monitored IPs went down at once — likely an "
                f"upstream / monitoring-side issue rather than {down} separate faults. "
                f"Per-IP alerts are suppressed until it clears.")
        await self._dispatch("mass_outage", title, body, {"down": down, "total": total})

    async def _dispatch(self, kind: str, title: str, body: str, extra: dict) -> None:
        link = _link_for(extra)
        event = {"kind": kind, "title": title, "body": body,
                 "at": _now().isoformat(), "link": link, **extra}
        self.events.append(event)
        log.info("alert: %s", title)
        await asyncio.gather(
            self._send_webhook(event),
            self._send_email(title, body, link),
            self._send_telegram(title, body, link),
            return_exceptions=True,
        )

    async def _send_webhook(self, event: dict) -> None:
        url = settings.ALERT_WEBHOOK_URL
        if not url:
            return
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                # `text` is what Slack/Discord/Telegram-proxy expect; full event included too.
                await c.post(url, json={"text": f"{event['title']}\n{event['body']}", **event})
        except Exception as exc:
            log.warning("alert webhook failed: %s", exc)

    async def _send_telegram(self, title: str, body: str, link: str | None = None) -> None:
        s = settings
        if not (s.ALERT_TELEGRAM_BOT_TOKEN and s.ALERT_TELEGRAM_CHAT_ID):
            return
        # HTML parse mode: bold title, plain body. Escape the few chars that are
        # special to Telegram's HTML so device labels/IPs can't break the markup.
        text = f"<b>{_tg_escape(title)}</b>\n{_tg_escape(body)}"
        if link:
            # Render as an <a> so it shows as "Open in console" rather than a
            # raw URL. The href is escaped too — IPs/paths are safe but cheap.
            text += f'\n<a href="{_tg_escape(link)}">Open in console →</a>'
        url = f"{s.ALERT_TELEGRAM_API.rstrip('/')}/bot{s.ALERT_TELEGRAM_BOT_TOKEN}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                resp = await c.post(url, json={
                    "chat_id": s.ALERT_TELEGRAM_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                })
                if resp.status_code != 200:
                    # Telegram returns a JSON description on failure (bad token,
                    # chat not started, etc.) — log it but never raise.
                    log.warning("alert telegram failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            log.warning("alert telegram failed: %s", exc)

    async def _send_email(self, subject: str, body: str, link: str | None = None) -> None:
        s = settings
        if not (s.ALERT_SMTP_HOST and s.ALERT_EMAIL_FROM and s.ALERT_EMAIL_TO):
            return
        try:
            await asyncio.to_thread(self._smtp_send, subject, body, link)
        except Exception as exc:
            log.warning("alert email failed: %s", exc)

    def _smtp_send(self, subject: str, body: str, link: str | None = None) -> None:
        s = settings
        msg = EmailMessage()
        msg["Subject"] = f"[SPEEDNeT] {subject}"
        msg["From"] = s.ALERT_EMAIL_FROM
        msg["To"] = s.ALERT_EMAIL_TO
        msg.set_content(f"{body}\n\n{link}" if link else body)
        with smtplib.SMTP(s.ALERT_SMTP_HOST, s.ALERT_SMTP_PORT, timeout=15) as smtp:
            if s.ALERT_SMTP_TLS:
                smtp.starttls()
            if s.ALERT_SMTP_USER:
                smtp.login(s.ALERT_SMTP_USER, s.ALERT_SMTP_PASSWORD)
            smtp.send_message(msg)


manager = AlertManager()
