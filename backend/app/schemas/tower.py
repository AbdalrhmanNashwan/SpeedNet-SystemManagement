"""Pydantic schemas for towers."""
from pydantic import BaseModel, ConfigDict, field_validator


def _validate_coord(v: str | None, *, limit: float) -> str | None:
    """Normalize a GPS coordinate string. Empty/None clears it; anything else
    must be a finite decimal within +/-`limit` (90 for lat, 180 for lng). Keeps
    junk (URLs, 'N/A', out-of-range numbers) out of the DB so the map can trust
    every stored coordinate."""
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        n = float(s)
    except (TypeError, ValueError):
        raise ValueError("must be a decimal number")
    if n != n or abs(n) == float("inf"):
        raise ValueError("must be a finite number")
    if abs(n) > limit:
        raise ValueError(f"must be between -{limit} and {limit}")
    return s


class _CoordMixin:
    @field_validator("gps_lat")
    @classmethod
    def _v_lat(cls, v):
        return _validate_coord(v, limit=90)

    @field_validator("gps_lng")
    @classmethod
    def _v_lng(cls, v):
        return _validate_coord(v, limit=180)


class TowerBase(BaseModel):
    name: str
    agent: str | None = None
    agency_id: str | None = None
    reseller: str | None = None
    affiliate: str | None = None
    phone: str | None = None
    link_type: str | None = None
    switch_type: str | None = None
    user_count: str | None = None
    vlan: str | None = None
    admin_page: str | None = None
    admin_pass: str | None = None
    area: str | None = None
    gps_lat: str | None = None
    gps_lng: str | None = None
    height: str | None = None
    parent_name: str | None = None
    parent_id: int | None = None
    port: str | None = None
    feed_model: str | None = None
    fed_by: str | None = None
    feed_port: str | None = None
    feed_mode: str | None = None
    status: str = "Active"
    notes: str | None = None
    zone_id: int | None = None


class TowerCreate(_CoordMixin, TowerBase):
    pass


class TowerUpdate(_CoordMixin, BaseModel):
    # all optional for PATCH
    model_config = ConfigDict(extra="ignore")
    name: str | None = None
    agent: str | None = None
    agency_id: str | None = None
    reseller: str | None = None
    affiliate: str | None = None
    phone: str | None = None
    link_type: str | None = None
    switch_type: str | None = None
    user_count: str | None = None
    vlan: str | None = None
    admin_page: str | None = None
    admin_pass: str | None = None
    area: str | None = None
    gps_lat: str | None = None
    gps_lng: str | None = None
    height: str | None = None
    parent_id: int | None = None
    port: str | None = None
    feed_model: str | None = None
    fed_by: str | None = None
    feed_port: str | None = None
    feed_mode: str | None = None
    status: str | None = None
    notes: str | None = None
    zone_id: int | None = None


class TowerOut(TowerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
