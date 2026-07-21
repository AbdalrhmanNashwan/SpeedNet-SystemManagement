"""Backfill tower Service-source fields from legacy notes.

Many towers stored their feed as a note like "328-bpwatani452-eth5-tag".
This copies that into the structured fields (feed_model / fed_by / feed_port /
feed_mode) so the console can search and group by source switch.

Safe & idempotent:
  * only touches notes that STRICTLY match model-switch-port-mode
  * never overwrites a tower that already has fed_by set
  * leaves the original note untouched
  * --dry-run shows what would change without writing

    python scripts/backfill_service_source.py --dry-run
    python scripts/backfill_service_source.py
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.tower import Tower

# 328-bpwatani452-eth5-tag  ->  (model, switch, port, mode)
# switch may itself contain dashes; port is eth#/ether#/sfp#; mode is tag/untag.
PATTERN = re.compile(
    r"^\s*([A-Za-z0-9]+)-(.+)-((?:eth|ether|sfp)\d+)-(tag|untag)\s*$",
    re.IGNORECASE,
)


async def main(dry_run: bool = False):
    filled, skipped_has, skipped_nomatch = 0, 0, 0
    async with AsyncSessionLocal() as db:
        towers = (await db.execute(select(Tower))).scalars().all()
        for t in towers:
            if not t.notes:
                continue
            m = PATTERN.match(t.notes)
            if not m:
                continue
            if (t.fed_by or "").strip():
                skipped_has += 1
                continue
            model, switch, port, mode = (g.strip() for g in m.groups())
            print(f"  [{t.name}]  {t.notes!r}")
            print(f"      -> model={model}  fed_by={switch}  port={port}  mode={mode.lower()}")
            if not dry_run:
                t.feed_model = model
                t.fed_by = switch
                t.feed_port = port
                t.feed_mode = mode.lower()
            filled += 1
        if not dry_run:
            await db.commit()

    print("\n--- summary ---")
    print(f"{'WOULD FILL' if dry_run else 'FILLED'}: {filled}")
    print(f"skipped (already had fed_by): {skipped_has}")
    if dry_run:
        print("\n(dry run — nothing written. Re-run without --dry-run to apply.)")


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv[1:]))
