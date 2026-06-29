"""Scan every UBNT (airOS) radio, read its real model, and store it in device_type.

For each links/sectors row that has an IP:
  1. Check the device is reachable (TCP 443, then 80) and pick the scheme.
  2. Log into airOS, ignoring the self-signed-cert "privacy error" (verify=False).
     Credentials tried in order: the stored user/pass, then the fallback creds
     from UBNT_FALLBACK_CREDS (env). If all fail, the device is skipped.
  3. Read /status.cgi JSON -> host.devmodel (e.g. "Rocket M5").
  4. Write that model into the row's device_type column.

Network calls run concurrently (bounded by SEM) but DB writes are serial and
committed in batches, so a large fleet is scanned without hammering the box.

Run:  python scripts/scan_ubnt.py            # default concurrency
      python scripts/scan_ubnt.py 40         # custom concurrency
"""
import asyncio
import os
import ssl
import sys
import warnings
from pathlib import Path

warnings.simplefilter("ignore")  # silence legacy-TLS deprecation noise

# stream output line-by-line so progress is visible while running in background
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.device import Link, Sector  # noqa: E402

# ---- tunables -------------------------------------------------------------
CONCURRENCY = int(sys.argv[1]) if len(sys.argv) > 1 else 30
TCP_TIMEOUT = 1.5       # seconds for the reachability probe
HTTP_TIMEOUT = 4.0      # seconds per HTTP request
DEVICE_DEADLINE = 12.0  # hard cap on total time spent on one device
COMMIT_EVERY = 25       # flush DB writes in batches

# Fallback login creds tried when a row has no stored credentials. Kept out of
# source: set UBNT_FALLBACK_CREDS="user:pass,user:pass" in the environment/.env.
# Falls back to common UBNT defaults if unset.
def _load_fallback_creds() -> list[tuple[str, str]]:
    raw = os.environ.get("UBNT_FALLBACK_CREDS", "")
    creds = [tuple(p.split(":", 1)) for p in raw.split(",") if ":" in p]
    return creds or [("ubnt", "ubnt")]

FALLBACK_CREDS = _load_fallback_creds()

sem = asyncio.Semaphore(CONCURRENCY)


def _legacy_ssl() -> ssl.SSLContext:
    """airOS radios use old TLS versions / ciphers that modern OpenSSL rejects.
    This context allows them (and ignores the self-signed cert = privacy error)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        ctx.minimum_version = ssl.TLSVersion.TLSv1
    except Exception:
        pass
    try:
        ctx.set_ciphers("DEFAULT@SECLEVEL=0")
    except Exception:
        pass
    return ctx


SSL_CTX = _legacy_ssl()


def _creds(user: str | None, pwd: str | None) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    if user and pwd:
        out.append((user, pwd))
    for c in FALLBACK_CREDS:
        if c not in out:
            out.append(c)
    return out


async def _tcp_open(ip: str, port: int) -> bool:
    try:
        fut = asyncio.open_connection(ip, port)
        _, writer = await asyncio.wait_for(fut, TCP_TIMEOUT)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


def _model_from_status(payload: dict) -> str | None:
    host = payload.get("host") or {}
    model = host.get("devmodel") or host.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()
    return None


async def _login_and_model(client: httpx.AsyncClient, base: str,
                           user: str, pwd: str) -> str | None:
    """Returns the model on success, None on bad creds. Raises on network
    trouble (timeout/connect) so the caller can stop wasting time on this host."""
    # airOS sets the AIROS_SESSIONID cookie on the login page; login.cgi needs it.
    await client.get(f"{base}/", timeout=HTTP_TIMEOUT)
    await client.post(f"{base}/login.cgi",
                      data={"username": user, "password": pwd, "uri": "/"},
                      timeout=HTTP_TIMEOUT)
    resp = await client.get(f"{base}/status.cgi", timeout=HTTP_TIMEOUT)
    if resp.status_code != 200:
        return None
    try:
        return _model_from_status(resp.json())  # login page returns HTML -> None
    except Exception:
        return None


async def _scan_http(base: str, user: str | None, pwd: str | None) -> dict | None:
    async with httpx.AsyncClient(verify=SSL_CTX, follow_redirects=True,
                                 timeout=HTTP_TIMEOUT) as client:
        for u, p in _creds(user, pwd):
            try:
                model = await _login_and_model(client, base, u, p)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError):
                return None  # host not speaking HTTP nicely — don't retry creds
            except Exception:
                model = None
            if model:
                return {"model": model, "user": u}
            client.cookies.clear()
    return None


async def scan(table: str, row_id: int, ip: str,
               user: str | None, pwd: str | None) -> dict:
    async with sem:
        scheme = "https" if await _tcp_open(ip, 443) else \
                 "http" if await _tcp_open(ip, 80) else None
        if not scheme:
            return {"table": table, "id": row_id, "ip": ip, "status": "unreachable"}
        try:
            hit = await asyncio.wait_for(
                _scan_http(f"{scheme}://{ip}", user, pwd), DEVICE_DEADLINE)
        except (asyncio.TimeoutError, Exception):
            hit = None
        if hit:
            return {"table": table, "id": row_id, "ip": ip, "status": "ok", **hit}
        return {"table": table, "id": row_id, "ip": ip, "status": "auth_failed"}


async def main():
    print(f"UBNT scan — concurrency={CONCURRENCY}\n")
    targets: list[tuple[str, int, str, str | None, str | None]] = []
    async with AsyncSessionLocal() as db:
        for Model, name in ((Link, "links"), (Sector, "sectors")):
            rows = (await db.execute(
                select(Model.id, Model.ip, Model.username, Model.password)
                .where(Model.ip.isnot(None), Model.ip != "")
            )).all()
            targets.extend((name, r.id, r.ip.strip(), r.username, r.password) for r in rows)
    print(f"Scanning {len(targets)} UBNT devices (links + sectors)…\n")

    tasks = [asyncio.create_task(scan(*t)) for t in targets]
    counts = {"ok": 0, "auth_failed": 0, "unreachable": 0}
    done = pending = 0
    total = len(tasks)

    async with AsyncSessionLocal() as db:
        for coro in asyncio.as_completed(tasks):
            res = await coro
            done += 1
            counts[res["status"]] = counts.get(res["status"], 0) + 1
            if res["status"] == "ok":
                Model = Link if res["table"] == "links" else Sector
                obj = await db.get(Model, res["id"])
                if obj is not None:
                    obj.device_type = res["model"]
                    pending += 1
                print(f"  [{done}/{total}] {res['ip']:<16} {res['model']}  (as {res['user']})")
                if pending >= COMMIT_EVERY:
                    await db.commit()
                    pending = 0
            if done % 50 == 0:
                print(f"  …progress {done}/{total} "
                      f"(ok={counts['ok']} auth_failed={counts['auth_failed']} "
                      f"unreachable={counts['unreachable']})")
        await db.commit()

    print("\nDone.")
    print(f"  updated (model found): {counts['ok']}")
    print(f"  auth failed:           {counts['auth_failed']}")
    print(f"  unreachable:           {counts['unreachable']}")


if __name__ == "__main__":
    asyncio.run(main())
