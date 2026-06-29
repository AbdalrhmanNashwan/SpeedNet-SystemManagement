"""Mount all route modules under the API prefix."""
from fastapi import APIRouter

from app.api.routes import (auth, towers, devices, zones, ip, users,
                            audit_route, monitor, backup_route)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(towers.router)
api_router.include_router(devices.router)
api_router.include_router(zones.router)
api_router.include_router(ip.router)
api_router.include_router(users.router)
api_router.include_router(audit_route.router)
api_router.include_router(monitor.router)
api_router.include_router(backup_route.router)
