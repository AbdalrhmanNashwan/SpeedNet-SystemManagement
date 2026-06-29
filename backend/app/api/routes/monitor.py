"""IP monitor endpoints — read the in-memory ping cache, or force a single check."""
from fastapi import APIRouter, Depends, HTTPException, status as http

from app.core.deps import get_current_user
from app.models.user import User
from app.services import monitor

router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.get("/status")
async def status(user: User = Depends(get_current_user)):
    """Latest ping status for every tracked IP, plus a summary.

    Cheap: returns the cached snapshot built by the background monitor task.
    The frontend polls this every few seconds.
    """
    return monitor.state.snapshot()


@router.post("/check")
async def check(ip: str, user: User = Depends(get_current_user)):
    """Ping one IP immediately and return its fresh result (also updates cache).

    Restricted to IPs already discovered from the database, so the endpoint
    can't be used to make the server probe arbitrary hosts.
    """
    from app.services.monitor import _parse_ip
    norm = _parse_ip(ip) or ip
    if norm not in monitor.state.refs and norm not in monitor.state.results:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "IP is not part of the monitored set")
    result = await monitor.check_ip(ip)
    if result is None:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, f"Not a valid IP: {ip}")
    return result
