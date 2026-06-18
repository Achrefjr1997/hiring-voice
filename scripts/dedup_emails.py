import sys; sys.path.insert(0, ".")
import asyncio
from voicehire.db.database import async_session, init_db
from voicehire.db.models import Candidate
from sqlalchemy import select, func

async def dedup():
    await init_db()
    async with async_session() as session:
        rows = (await session.execute(select(Candidate).order_by(Candidate.created_at))).scalars().all()
        seen: dict[str, list] = {}
        for r in rows:
            seen.setdefault(r.email, []).append(r)

        dupes = {e: ids for e, ids in seen.items() if len(ids) > 1}
        if not dupes:
            print("No duplicate emails found.")
            return

        fixed = 0
        for email, candidates in dupes.items():
            local, domain = email.rsplit("@", 1) if "@" in email else (email, "fixme.com")
            for i, c in enumerate(candidates):
                if i == 0:
                    continue
                new_email = f"{local}+{i}@{domain}"
                c.email = new_email
                fixed += 1
                print(f"  {c.id[:8]} | {c.first_name} {c.last_name} | {email} -> {new_email}")

        await session.commit()
        print(f"\nFixed {fixed} duplicate email(s) across {len(dupes)} group(s).")

asyncio.run(dedup())
