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

    # Auth
    SECRET_KEY: str = "CHANGE_ME_run_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

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

    # ---- Automatic backups ----
    BACKUP_ENABLED: bool = True
    BACKUP_INTERVAL_HOURS: float = 6.0     # how often to dump all tables to CSV
    BACKUP_DIR: str = "backups"            # where the .zip archives are written
    BACKUP_RETENTION: int = 28             # keep the newest N archives (28 = ~1 week at 6h)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
