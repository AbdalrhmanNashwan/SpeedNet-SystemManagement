"""Expand short switch-model values in towers.feed_model to full MikroTik names.

Only rewrites values where the mapping is UNAMBIGUOUS (no two MikroTik families
share these numbers). Anything not in the map is left exactly as-is and reported,
so nothing uncertain is ever changed. Idempotent: already-full names are skipped.

    python scripts/normalize_feed_model.py --dry-run
    python scripts/normalize_feed_model.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.tower import Tower

# Confident, unambiguous expansions only (matches SWITCH_TYPE_OPTIONS full names).
MODEL_MAP = {
    "326": "CRS326",
    "328": "CRS328",
    "1009": "CCR1009",
    "1036": "CCR1036",
    "2011": "RB2011",
    "3011": "RB3011",
    "4011": "RB4011",
}


async def main(dry_run: bool = False):
    changed, skipped_unknown, already_ok = 0, [], 0
    async with AsyncSessionLocal() as db:
        towers = (await db.execute(
            select(Tower).where(Tower.feed_model.is_not(None))
        )).scalars().all()
        for t in towers:
            cur = (t.feed_model or "").strip()
            if not cur:
                continue
            full = MODEL_MAP.get(cur)
            if full is None:
                # not a known short code — leave it (already full, or unfamiliar)
                if cur not in MODEL_MAP.values():
                    skipped_unknown.append(cur)
                else:
                    already_ok += 1
                continue
            print(f"  [{t.name}]  feed_model: {cur!r} -> {full!r}")
            if not dry_run:
                t.feed_model = full
            changed += 1
        if not dry_run:
            await db.commit()

    print("\n--- summary ---")
    print(f"{'WOULD CHANGE' if dry_run else 'CHANGED'}: {changed}")
    print(f"already full name (skipped): {already_ok}")
    if skipped_unknown:
        uniq = sorted(set(skipped_unknown))
        print(f"left as-is (not in confident map): {uniq}")
    if dry_run:
        print("\n(dry run — nothing written. Re-run without --dry-run to apply.)")


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv[1:]))
