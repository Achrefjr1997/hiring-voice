import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_db_path = "/app/db_data/voicehire.db"
if not os.path.isdir("/app/db_data"):
    _db_path = os.path.join(os.path.dirname(__file__), "..", "..", "db_data", "voicehire.db")
DATABASE_URL = f"sqlite+aiosqlite:///{_db_path}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add recruiter_id to candidates if missing
        try:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE candidates ADD COLUMN recruiter_id TEXT REFERENCES users(id)"
                )
            )
            await conn.execute(
                __import__("sqlalchemy").text(
                    "CREATE INDEX IF NOT EXISTS ix_candidates_recruiter_id ON candidates(recruiter_id)"
                )
            )
        except Exception:
            pass  # Column already exists
