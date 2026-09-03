"""
One-time backfill: recompute Ranking rows for every exam that already has
published results.

Why this is needed: the single-result `publish` endpoint used to skip
`_update_rankings()`, so any exam whose results were published one-by-one
(rather than via `publish-all`) has an empty `rankings` table even though its
`results` are published. That code path is now fixed going forward, but
existing data needs to be recalculated once.

Usage (from the `backend/` directory, with your normal environment/venv):
    python -m scripts.backfill_rankings
"""

import asyncio

from sqlalchemy import select

from database.session import AsyncSessionLocal
from models import Result
from services.grading import _update_rankings


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # Every distinct exam_id that has at least one published result.
        exam_ids_result = await db.execute(
            select(Result.exam_id).where(Result.is_published.is_(True)).distinct()
        )
        exam_ids = [row[0] for row in exam_ids_result.all()]

        if not exam_ids:
            print("No published results found — nothing to backfill.")
            return

        print(f"Recomputing rankings for {len(exam_ids)} exam(s)...")

        for exam_id in exam_ids:
            await _update_rankings(exam_id, db)
            await db.commit()
            print(f"  ✓ {exam_id}")

        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
