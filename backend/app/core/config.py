"""Application settings, loaded from environment / .env."""
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://speednet:changeme@db:5432/speednet"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def _use_asyncpg(cls, v: str) -> str:
        """Accept the plain postgres:// URLs that hosts like Render hand out and
        convert them to the async driver SQLAlchemy needs. Also drops libpq's
        ``sslmode`` query param, which asyncpg does not understand."""
        if v.startswith("postgres://"):
            v = "postgresql://" + v.split("://", 1)[1]
        if v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v.split("://", 1)[1]
        # Managed hosts (Neon, Supabase, …) hand out libpq-style query params.
        # asyncpg/SQLAlchemy use `ssl=` instead of `sslmode=`, and don't know
        # `channel_binding` at all — translate so SSL-required DBs still connect.
        if "sslmode=" in v or "channel_binding=" in v:
            from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
            parts = urlsplit(v)
            q = []
            for k, val in parse_qsl(parts.query):
                if k == "sslmode":
                    q.append(("ssl", val))       # e.g. require / verify-full
                elif k == "channel_binding":
                    continue                      # unsupported — drop
                else:
                    q.append((k, val))
            v = urlunsplit(parts._replace(query=urlencode(q)))
        return v

    # Deployment environment. "production" turns on prod-only hardening such as
    # HSTS; leave as "dev" locally. Set ENV=production in the production .env.
    ENV: str = "dev"
    # Root log level for the app's own loggers (monitor, alerts, outages,
    # backup). DEBUG is very chatty on a per-sweep basis — leave at INFO.
    LOG_LEVEL: str = "INFO"

    # Auth
    SECRET_KEY: str = "CHANGE_ME_run_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def _secret_key_must_be_strong(cls, v: str) -> str:
        """Refuse to boot with the shipped placeholder or an obviously weak key.
        Every JWT is signed with this — a known/guessable key lets anyone forge
        an admin token and skip login entirely. Generate one with
        `openssl rand -hex 32` and set SECRET_KEY in .env."""
        if v.strip() in ("", "CHANGE_ME_run_openssl_rand_hex_32") or len(v.strip()) < 32:
            raise ValueError(
                "SECRET_KEY is missing, the placeholder, or too short (need >= 32 "
                "chars). Generate one with `openssl rand -hex 32` and set it in .env."
            )
        return v

    # CORS — set to your frontend origin in production, e.g. https://net.speednet.iq
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # App
    PROJECT_NAME: str = "SPEEDNeT Console"
    API_PREFIX: str = "/api"

    # ---- IP monitor (ping) ----
    # Background pinger that continuously checks every IP found in the DB and
    # caches up/down status in memory for the /monitor endpoints.
    MONITOR_ENABLED: bool = True
    # How many IPs to ping concurrently in a single batch. Keep modest so a
    # large IP list does not overwhelm a non-beefy server / its uplink.
    MONITOR_CONCURRENCY: int = 50
    # ICMP packets per host per check, and per-packet timeout (seconds).
    MONITOR_COUNT: int = 1
    MONITOR_TIMEOUT: float = 1.0
    # Idle gap (seconds) between finishing one full sweep and starting the next.
    MONITOR_CYCLE_GAP: float = 10.0
    # How often (seconds) to re-read the IP list from the DB (picks up edits).
    MONITOR_REFRESH_IPS: float = 120.0
    # ICMP raw sockets need privilege (root / CAP_NET_RAW in Docker, Admin on
    # Windows). Set False on Linux/macOS to use unprivileged ICMP datagram
    # sockets instead. Windows always needs privileged=True.
    MONITOR_PRIVILEGED: bool = True
    # Shared secret for the external monitor AGENT (see scripts/monitor_agent.py).
    # When the app is hosted somewhere that cannot reach the private device IPs
    # (e.g. a cloud PaaS), an agent running INSIDE the network pings the devices
    # and pushes status to /monitor/ingest using this token. Empty = disabled.
    MONITOR_AGENT_TOKEN: str = ""

    # ---- Outage history (durable, for uptime reporting) ----
    # Recorded independently of ALERT_* on purpose: alerting is throttled by
    # cooldowns and the mass-outage freeze, and reusing those gates here would
    # leave holes in the history. Turn off only if you don't want the table
    # written at all.
    OUTAGE_HISTORY_ENABLED: bool = True
    OUTAGE_FAIL_THRESHOLD: int = 3
    OUTAGE_RECOVER_THRESHOLD: int = 2

    # ---- Down-alert notifications ----
    # Off by default; turn on once a channel below is configured.
    ALERT_ENABLED: bool = False
    # An IP must be down this many CONSECUTIVE sweeps before it counts as
    # "confirmed down" — filters out brief blips / "few seconds off".
    ALERT_FAIL_THRESHOLD: int = 3
    # …and up this many consecutive sweeps before we announce recovery.
    ALERT_RECOVER_THRESHOLD: int = 2
    # Minimum minutes between repeat DOWN alerts for the SAME ip — flap damper.
    ALERT_COOLDOWN_MINUTES: float = 30.0
    # Mass-outage guard: if at least ALERT_MASS_OUTAGE_MIN IPs are tracked and
    # at least this FRACTION of them are down in one sweep, treat it as a single
    # monitoring-side / upstream event — send ONE aggregate alert, suppress the
    # per-IP storm (handles "everything looks down for a few seconds").
    ALERT_MASS_OUTAGE_RATIO: float = 0.5
    ALERT_MASS_OUTAGE_MIN: int = 10
    # Keep this many recent alert events in memory for the UI/endpoint.
    ALERT_HISTORY_SIZE: int = 200

    # Channel 1 — generic webhook (POST JSON). Works with Telegram bot proxies,
    # Slack/Discord incoming webhooks, n8n, etc. Empty = disabled.
    ALERT_WEBHOOK_URL: str = ""
    # Channel 2 — SMTP email. All four must be set for email to send.
    ALERT_SMTP_HOST: str = ""
    ALERT_SMTP_PORT: int = 587
    ALERT_SMTP_USER: str = ""
    ALERT_SMTP_PASSWORD: str = ""
    ALERT_SMTP_TLS: bool = True
    ALERT_EMAIL_FROM: str = ""
    ALERT_EMAIL_TO: str = ""        # comma-separated recipients

    # Channel 3 — Telegram bot. Both must be set for Telegram alerts to send.
    # Get the bot token from @BotFather; the chat id is the user/group the bot
    # posts to (the bot must have received a /start from that chat first, or be
    # a member of the target group). Empty = disabled.
    ALERT_TELEGRAM_BOT_TOKEN: str = ""
    ALERT_TELEGRAM_CHAT_ID: str = ""
    # Telegram Bot API base — override only for a self-hosted API server.
    ALERT_TELEGRAM_API: str = "https://api.telegram.org"

    # Public base URL of the console, used to build clickable deep links in
    # alerts (e.g. straight to the affected tower). No trailing slash and no
    # /console suffix — that prefix is added automatically. Empty = no link.
    # Set per-environment in .env (e.g. http://192.168.5.19:5173 on the LAN,
    # or https://net.speednet.iq in production).
    ALERT_LINK_BASE_URL: str = ""

    # ---- Automatic backups ----
    BACKUP_ENABLED: bool = True
    BACKUP_INTERVAL_HOURS: float = 6.0     # how often to dump all tables to CSV
    BACKUP_DIR: str = "backups"            # where the .zip archives are written
    BACKUP_RETENTION: int = 28             # keep the newest N archives (28 = ~1 week at 6h)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
