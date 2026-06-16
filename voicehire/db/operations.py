import time
import asyncio
from sqlalchemy import update, select, func
from voicehire.db.database import async_session
from voicehire.db.models import User as UserModel, Session as SessionModel, Event as EventModel

ROOM_TO_SESSION: dict[str, str] = {}


async def db_create_session(
    session_id: str,
    jd: str = "",
    resume: str = "",
    rubric: str = "",
    enforcement_config: dict | None = None,
    demo_mode: bool = True,
    recruiter_id: str | None = None,
    candidate_email: str | None = None,
) -> None:
    try:
        async with async_session() as session:
            db_session = SessionModel(
                id=session_id,
                jd=jd,
                resume=resume,
                rubric=rubric,
                enforcement_config=enforcement_config or {},
                demo_mode=demo_mode,
                recruiter_id=recruiter_id,
                candidate_email=candidate_email,
            )
            session.add(db_session)
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to create session {session_id}: {e}")


async def db_create_user(email: str, hashed_password: str) -> str:
    try:
        async with async_session() as session:
            user = UserModel(email=email, hashed_password=hashed_password)
            session.add(user)
            await session.commit()
            return user.id
    except Exception as e:
        print(f"[db] Failed to create user {email}: {e}")
        raise


async def db_get_user_by_email(email: str) -> UserModel | None:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.email == email)
            )
            return result.scalar_one_or_none()
    except Exception as e:
        print(f"[db] Failed to get user by email: {e}")
        return None


async def db_get_sessions_by_recruiter(recruiter_id: str) -> list[dict]:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(
                    SessionModel.id,
                    SessionModel.candidate_name,
                    SessionModel.status,
                    SessionModel.created_at,
                    func.count(EventModel.id).label("violation_count"),
                )
                .outerjoin(EventModel, (EventModel.session_id == SessionModel.id) & (EventModel.event_type == "INTEGRITY_VIOLATION"))
                .where(SessionModel.recruiter_id == recruiter_id)
                .group_by(SessionModel.id)
                .order_by(SessionModel.created_at.desc())
            )
            rows = result.all()
            return [
                {
                    "id": r.id,
                    "candidate_name": r.candidate_name,
                    "status": r.status,
                    "created_at": r.created_at,
                    "violation_count": r.violation_count or 0,
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[db] Failed to get sessions for recruiter {recruiter_id}: {e}")
        return []


async def db_get_session_history(session_id: str) -> dict | None:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(SessionModel).where(SessionModel.id == session_id)
            )
            db_session = result.scalar_one_or_none()
            if not db_session:
                return None

            events_result = await session.execute(
                select(EventModel)
                .where(EventModel.session_id == session_id)
                .order_by(EventModel.id.asc())
            )
            events = events_result.scalars().all()

            return {
                "session": {
                    "id": db_session.id,
                    "candidate_name": db_session.candidate_name,
                    "candidate_email": db_session.candidate_email,
                    "status": db_session.status,
                    "created_at": db_session.created_at,
                    "ended_at": db_session.ended_at,
                    "demo_mode": db_session.demo_mode,
                    "enforcement_config": db_session.enforcement_config,
                },
                "events": [
                    {
                        "id": e.id,
                        "event_type": e.event_type,
                        "payload": e.payload,
                        "timestamp": e.timestamp,
                    }
                    for e in events
                ],
                "report": db_session.report_json,
            }
    except Exception as e:
        print(f"[db] Failed to get session history for {session_id}: {e}")
        return None


async def db_insert_event(
    session_id: str,
    event_type: str,
    payload: dict | None = None,
    timestamp: float | None = None,
) -> None:
    try:
        async with async_session() as session:
            event = EventModel(
                session_id=session_id,
                event_type=event_type,
                payload=payload or {},
                timestamp=timestamp or time.time(),
            )
            session.add(event)
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to insert event for session {session_id}: {e}")


async def db_end_session(
    session_id: str,
    report_json: dict | None = None,
) -> None:
    try:
        async with async_session() as session:
            await session.execute(
                update(SessionModel)
                .where(SessionModel.id == session_id)
                .values(status="completed", ended_at=time.time(), report_json=report_json)
            )
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to end session {session_id}: {e}")
