"""Device CRUD + transfer between sections/towers.

TRANSFER_FIELD_MAP defines which fields carry over when a row changes type.
Shared keys (ip, username, password, gateway, subnet, note, flags, device_name)
move directly; type-specific keys are dropped if the target lacks them.
"""
from app.models.device import Link, Switch, Sector, Server

MODEL_BY_TYPE = {"links": Link, "switches": Switch, "sectors": Sector, "servers": Server}

# columns each type actually has (besides id/tower_id/timestamps)
TYPE_FIELDS = {
    "links": {"ssid","device_name","device_type","wireless_pass","unlock_code",
              "serial_number","mac_address","username","password","ip","gateway",
              "subnet","vlan","port","target","note","flags"},
    "switches": {"ip","username","password","model","gateway","subnet","note","flags"},
    "sectors": {"ssid","device_name","device_type","wireless_pass","serial_number",
                "mac_address","username","password","ip","gateway","subnet","note","flags"},
    "servers": {"device_name","username","password","url","note","flags"},
}


def project_fields(row: dict, to_type: str) -> dict:
    """Keep only fields valid for the target type."""
    allowed = TYPE_FIELDS[to_type]
    return {k: v for k, v in row.items() if k in allowed}
