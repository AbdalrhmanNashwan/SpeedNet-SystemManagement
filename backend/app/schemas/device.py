"""Pydantic schemas for devices (link/switch/sector/server) + transfer."""
from typing import Literal
from pydantic import BaseModel, ConfigDict

DeviceType = Literal["links", "switches", "sectors", "servers"]


class DeviceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tower_id: int
    note: str | None = None
    flags: list[str] = []
    # union of all device fields; unused ones stay None per type
    ssid: str | None = None
    device_name: str | None = None
    device_type: str | None = None
    wireless_pass: str | None = None
    unlock_code: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    username: str | None = None
    password: str | None = None
    ip: str | None = None
    gateway: str | None = None
    subnet: str | None = None
    vlan: str | None = None
    port: str | None = None
    target: str | None = None
    model: str | None = None
    url: str | None = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tower_id: int | None = None
    note: str | None = None
    flags: list[str] | None = None
    ssid: str | None = None
    device_name: str | None = None
    device_type: str | None = None
    wireless_pass: str | None = None
    unlock_code: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    username: str | None = None
    password: str | None = None
    ip: str | None = None
    gateway: str | None = None
    subnet: str | None = None
    vlan: str | None = None
    port: str | None = None
    target: str | None = None
    model: str | None = None
    url: str | None = None


class DeviceTransfer(BaseModel):
    """Move a device to another type and/or another tower."""
    to_type: DeviceType | None = None     # change section (link->sector etc.)
    to_tower_id: int | None = None        # move to another tower


class DeviceOut(DeviceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
