"""In-process failed-login lockout, keyed by account (email).

The per-IP rate limit on /auth/login can be dodged by an attacker with a pool
of source IPs, letting them keep hammering a single known account (e.g. the
admin). This adds a second, account-scoped brake: after MAX_FAILS wrong
passwords within the window, that email is locked out for LOCK_SECONDS
regardless of source IP. A successful login clears the counter.

The app runs as a single process (one monitor task, in-memory monitor state),
so a module-level dict guarded by a lock is sufficient and consistent with the
rest of the codebase. If the app is ever scaled to multiple workers this should
move to a shared store (Redis).
"""
import math
import time
from threading import Lock

MAX_FAILS = 5              # wrong passwords within the window before locking
WINDOW_SECONDS = 15 * 60   # rolling window / lock duration

_fails: dict[str, list[float]] = {}
_lock = Lock()


def _prune(hits: list[float], now: float) -> list[float]:
    cutoff = now - WINDOW_SECONDS
    return [t for t in hits if t > cutoff]


def retry_after(email: str) -> int:
    """Seconds the account must wait before another attempt, or 0 if not locked."""
    key = (email or "").strip().lower()
    if not key:
        return 0
    now = time.monotonic()
    with _lock:
        hits = _prune(_fails.get(key, []), now)
        _fails[key] = hits
        if len(hits) < MAX_FAILS:
            return 0
        # locked until the oldest in-window failure ages out
        return max(0, math.ceil(WINDOW_SECONDS - (now - hits[0])))


def record_failure(email: str) -> None:
    key = (email or "").strip().lower()
    if not key:
        return
    now = time.monotonic()
    with _lock:
        hits = _prune(_fails.get(key, []), now)
        hits.append(now)
        _fails[key] = hits


def clear(email: str) -> None:
    key = (email or "").strip().lower()
    with _lock:
        _fails.pop(key, None)
