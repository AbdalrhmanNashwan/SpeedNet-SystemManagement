"""Pydantic schemas for towers."""
from pydantic import BaseModel, ConfigDict


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
    status: str = "Active"
    notes: str | None = None
    zone_id: int | None = None


class TowerCreate(TowerBase):
    pass


class TowerUpdate(BaseModel):
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
    status: str | None = None
    notes: str | None = None
    zone_id: int | None = None


class TowerOut(TowerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
