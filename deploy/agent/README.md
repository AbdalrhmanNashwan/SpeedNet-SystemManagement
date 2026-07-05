# Monitor agent (run inside the SPEEDNeT network)

The console can be hosted where it can't reach your private `10.x` device IPs
(a cloud Space). This small agent runs on a machine **inside** the network that
*can* reach them: it pings the devices locally and pushes up/down status to the
console, so the **Monitor page works** — without any VPN into your network.

```
[ this agent, inside the NOC ]  --pings-->  10.x devices
          |  pushes status (HTTPS)
          v
[ console API ]  /monitor/ingest  -->  Monitor page
```

## Prerequisites

- A Linux box (or any machine) at the NOC that can **ping the `10.x` devices**
  and can reach the console URL over HTTPS.
- The **agent token**: set `MONITOR_AGENT_TOKEN` on the server, and give the
  agent the same value as `AGENT_TOKEN`.

## Run with Docker (recommended)

`--network host` so the agent uses the box's routes to reach `10.x`, and
`--cap-add NET_RAW` for raw ICMP:

```bash
# build once (from the repo root)
docker build -f deploy/agent/Dockerfile -t speednet-agent .

docker run -d --name speednet-agent --restart unless-stopped \
  --network host --cap-add NET_RAW \
  -e SPEEDNET_API="https://<your-space>.hf.space/api" \
  -e AGENT_TOKEN="<the MONITOR_AGENT_TOKEN value>" \
  -e INTERVAL=15 \
  speednet-agent

docker logs -f speednet-agent      # watch it sweep
```

## Run without Docker

```bash
pip install icmplib httpx
export SPEEDNET_API="https://<your-space>.hf.space/api"
export AGENT_TOKEN="<the MONITOR_AGENT_TOKEN value>"
# raw ICMP needs privilege:
sudo -E python backend/scripts/monitor_agent.py
# …or use unprivileged sockets (Linux) and skip sudo:
PRIVILEGED=0 python backend/scripts/monitor_agent.py
```

On Windows, run the terminal **as Administrator** (raw ICMP needs it) and use
`set SPEEDNET_API=...` / `set AGENT_TOKEN=...`.

## Tuning (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `INTERVAL` | 15 | seconds between full sweeps |
| `BATCH` | 50 | IPs pinged concurrently per batch |
| `COUNT` | 1 | ICMP packets per host |
| `TIMEOUT` | 1 | per-host timeout (seconds) |
| `PRIVILEGED` | 1 | `1` raw ICMP (root/NET_RAW/Admin); `0` unprivileged (Linux) |

## Verify

Open the console **Monitor** page — within a sweep or two it fills with live
up/down status. The agent log prints `pinged <n> · server: {...}` each cycle.
