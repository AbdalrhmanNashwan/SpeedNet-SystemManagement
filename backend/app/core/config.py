"""Application settings, loaded from environment / .env."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://speednet:changeme@db:5432/speednet"

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

    # ---- Automatic backups ----
    BACKUP_ENABLED: bool = True
    BACKUP_INTERVAL_HOURS: float = 6.0     # how often to dump all tables to CSV
    BACKUP_DIR: str = "backups"            # where the .zip archives are written
    BACKUP_RETENTION: int = 28             # keep the newest N archives (28 = ~1 week at 6h)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
