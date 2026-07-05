#!/usr/bin/env python3
"""SPEEDNeT monitor agent — run this INSIDE the SPEEDNeT network.

The console can be hosted anywhere (e.g. a free cloud Space), but the cloud has
no route to the private 10.x device IPs, so it can't ping them. This agent runs
on a machine that CAN reach those devices: it asks the cloud app which IPs to
watch, pings them locally, and pushes the up/down results back — so the Monitor
page works without exposing your network to the cloud.

Configure with environment variables:
  SPEEDNET_API   API base of the console, incl. /api
                 e.g. https://abddev20-speednet-console.hf.space/api
  AGENT_TOKEN    must equal MONITOR_AGENT_TOKEN set on the server
  INTERVAL       seconds between sweeps            (default 15)
  BATCH          ping concurrency per batch        (default 50)
  COUNT          ICMP packets per host             (default 1)
  TIMEOUT        per-host timeout, seconds         (default 1)
  PRIVILEGED     "1" raw ICMP (needs root/NET_RAW/Admin), "0" unprivileged
                 datagram sockets on Linux         (default 1)

Run (Python):   pip install icmplib httpx && python monitor_agent.py
Run (Docker):   see deploy/agent/README.md
"""
import asyncio
import os
import sys
import time

import httpx
from icmplib import async_multiping

API = os.environ.get("SPEEDNET_API", "").rstrip("/")
TOKEN = os.environ.get("AGENT_TOKEN", "")
INTERVAL = float(os.environ.get("INTERVAL", "15"))
BATCH = int(os.environ.get("BATCH", "50"))
COUNT = int(os.environ.get("COUNT", "1"))
TIMEOUT = float(os.environ.get("TIMEOUT", "1"))
PRIVILEGED = os.environ.get("PRIVILEGED", "1") != "0"


async def one_sweep(client: httpx.AsyncClient) -> tuple[int, dict]:
    headers = {"X-Agent-Token": TOKEN}
    r = await client.get(f"{API}/monitor/targets", headers=headers, timeout=30)
    r.raise_for_status()
    ips = r.json()["ips"]

    results = []
    for i in range(0, len(ips), BATCH):
        hosts = await async_multiping(
            ips[i:i + BATCH], count=COUNT, timeout=TIMEOUT,
            concurrent_tasks=BATCH, privileged=PRIVILEGED,
        )
        for h in hosts:
            results.append({
                "ip": h.address,
                "is_alive": h.is_alive,
                "latency_ms": h.avg_rtt if h.is_alive else None,
                "packet_loss": h.packet_loss,
            })

    resp = await client.post(f"{API}/monitor/ingest", json={"results": results},
                             headers=headers, timeout=60)
    resp.raise_for_status()
    return len(results), resp.json()


async def main() -> None:
    if not API or not TOKEN:
        print("ERROR: set SPEEDNET_API and AGENT_TOKEN", file=sys.stderr)
        sys.exit(1)
    print(f"agent -> {API}  every {INTERVAL}s  privileged={PRIVILEGED}")
    async with httpx.AsyncClient() as client:
        while True:
            started = time.time()
            try:
                n, info = await one_sweep(client)
                print(f"[{time.strftime('%H:%M:%S')}] pinged {n} · server: {info}")
            except Exception as exc:
                print(f"[{time.strftime('%H:%M:%S')}] error: {exc}", file=sys.stderr)
            await asyncio.sleep(max(1.0, INTERVAL - (time.time() - started)))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
