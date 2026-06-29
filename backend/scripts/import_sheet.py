"""One-time data importer: data/app_data.json -> PostgreSQL.

Run after `alembic upgrade head`:
    python scripts/import_sheet.py

Idempotent-ish: wipes the data tables first (NOT users) then reloads. Safe to
re-run while iterating. Computes device flags and resolves zone membership.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.models.zone import Zone  # noqa: E402
from app.models.tower import Tower  # noqa: E402
from app.models.device import Link, Switch, Sector, Server  # noqa: E402
from app.models.misc import IPAllocation, BackboneFeed  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "app_data.json"


async def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    async with AsyncSessionLocal() as db:
        # wipe data tables (keep users)
        for model in (BackboneFeed, IPAllocation, Server, Sector, Switch, Link, Tower, Zone):
            await db.execute(delete(model))
        await db.commit()

        # zones
        zone_id_by_name = {}
        for z in data.get("zones", []):
            zone = Zone(name=z["id"], tag=z.get("tag"), color=z.get("color"),
                        icon=z.get("icon"),
                        rule_field=("reseller" if "reseller" in z.get("rule", "") else
                                    "area" if "area" in z.get("rule", "") else None),
                        rule_value=z.get("rule", "").split("=")[-1].strip() or None)
            db.add(zone)
            await db.flush()
            zone_id_by_name[z["id"]] = zone.id

        # towers + devices
        tower_id_by_sheet = {}
        for t in data["towers"]:
            zone_id = zone_id_by_name.get(t.get("_zone")) if t.get("_zone") else None
            tower = Tower(
                name=t["sheet"], agent=t.get("agent"), agency_id=t.get("agency"),
                reseller=t.get("reseller"), affiliate=t.get("affiliate"),
                phone=t.get("phone"), link_type=t.get("link_type"),
                switch_type=t.get("switch_type"), user_count=t.get("users"),
                vlan=t.get("vlan"), admin_page=t.get("admin_page"),
                admin_pass=t.get("admin_pass"), area=t.get("area") or t.get("index_address"),
                gps_lat=t.get("gps_lat"), gps_lng=t.get("gps_lng"),
                height=t.get("height"), parent_name=t.get("parent"),
                port=t.get("port"), status=t.get("status", "Active"),
                notes=t.get("notes"), zone_id=zone_id,
            )
            db.add(tower)
            await db.flush()
            tower_id_by_sheet[t["sheet"]] = tower.id

            for l in t.get("links", []):
                db.add(Link(tower_id=tower.id, ssid=l.get("ssid"), device_name=l.get("device_name"),
                            device_type=l.get("devtype"), wireless_pass=l.get("wireless_pass"),
                            unlock_code=l.get("unlock_code"), serial_number=l.get("serial"),
                            mac_address=l.get("mac_address"), username=l.get("username"),
                            password=l.get("password"), ip=l.get("ip"), gateway=l.get("gateway"),
                            subnet=l.get("subnet"), vlan=l.get("vlan"), port=l.get("port"),
                            target=l.get("target"), note=l.get("note"), flags=l.get("_flags", [])))
            for s in t.get("switches", []):
                db.add(Switch(tower_id=tower.id, ip=s.get("ip"), username=s.get("username"),
                              password=s.get("password"), model=s.get("model"),
                              gateway=s.get("gateway"), subnet=s.get("subnet"),
                              note=s.get("note"), flags=s.get("_flags", [])))
            for s in t.get("sectors", []):
                db.add(Sector(tower_id=tower.id, ssid=s.get("ssid"), device_name=s.get("device_name"),
                              device_type=s.get("devtype"), wireless_pass=s.get("wireless_pass"),
                              serial_number=s.get("serial"), mac_address=s.get("mac_address"),
                              username=s.get("username"), password=s.get("password"),
                              ip=s.get("ip"), gateway=s.get("gateway"), subnet=s.get("subnet"),
                              note=s.get("note"), flags=s.get("_flags", [])))
            for sv in t.get("servers", []):
                db.add(Server(tower_id=tower.id, device_name=sv.get("device_name"),
                              username=sv.get("username"), password=sv.get("password"),
                              url=sv.get("url"), flags=sv.get("_flags", [])))
        await db.commit()

        # resolve tower parents
        for t in data["towers"]:
            if not t.get("parent"):
                continue
            pid = None
            for sheet, tid in tower_id_by_sheet.items():
                if t["parent"].lower() in sheet.lower():
                    pid = tid
                    break
            if pid:
                res = await db.execute(select(Tower).where(Tower.id == tower_id_by_sheet[t["sheet"]]))
                tower = res.scalar_one()
                tower.parent_id = pid
        await db.commit()

        # ip allocations
        for r in data.get("ip_table", []):
            db.add(IPAllocation(
                owner=r.get("owner"), point=r.get("point"), tower_ref=r.get("tower_ref"),
                link_type=r.get("link_type"), parent=r.get("parent"), vlan=r.get("vlan"),
                ip_block=r.get("ip_block"), ip_master=r.get("ip_master"),
                user_master=r.get("user_master"), pass_master=r.get("pass_master"),
                ip_slave=r.get("ip_slave"), user_slave=r.get("user_slave"),
                pass_slave=r.get("pass_slave"), sw_ip=r.get("sw_ip"),
                sw_pass=r.get("sw_pass"), rs_pass=r.get("rs_pass")))
        # backbone feeds
        for up in data.get("backbone", []):
            for f in up.get("feeds", []):
                fid = tower_id_by_sheet.get(f.get("match")) if f.get("match") else None
                db.add(BackboneFeed(switch_name=up["switch"], switch_ip=up["switch_ip"],
                                    port=f.get("port"), feeds_name=f.get("feeds"),
                                    feeds_tower_id=fid, ssid=f.get("ssid"),
                                    vlan=f.get("vlan"), ip=f.get("ip"), model=f.get("model")))
        await db.commit()

        # seed admin user if none exists
        res = await db.execute(select(User).limit(1))
        if not res.scalar_one_or_none():
            admin_email = os.getenv("ADMIN_EMAIL", "admin@speednet.iq")
            admin_pass = os.getenv("ADMIN_PASSWORD", "changeme123")
            db.add(User(email=admin_email, full_name="Admin",
                        hashed_password=hash_password(admin_pass), role="admin"))
            await db.commit()
            print(f"Seeded admin user: {admin_email} (change the password!)")

        # report
        async def count(model):
            r = await db.execute(select(model))
            return len(r.scalars().all())
        print("Imported:",
              await count(Tower), "towers,",
              await count(Link), "links,",
              await count(Switch), "switches,",
              await count(Sector), "sectors,",
              await count(IPAllocation), "ip,",
              await count(BackboneFeed), "backbone feeds")


if __name__ == "__main__":
    asyncio.run(main())
