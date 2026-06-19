import time
import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy import update, select, func, delete as sa_delete, text
from sqlalchemy.orm import selectinload
from voicehire.db.database import async_session
from voicehire.db.models import User as UserModel, Session as SessionModel, Event as EventModel, Candidate as CandidateModel, JobPosting as JobPostingModel, CandidateJobMatch as CandidateJobMatchModel

ROOM_TO_SESSION: dict[str, str] = {}


def _parse_date_range(start_date: str | None, end_date: str | None) -> tuple[float | None, float | None]:
    ts_start = None
    ts_end = None
    if start_date:
        try:
            ts_start = datetime.fromisoformat(start_date).timestamp()
        except ValueError:
            pass
    if end_date:
        try:
            dt = datetime.fromisoformat(end_date)
            ts_end = (dt + timedelta(days=1)).timestamp()
        except ValueError:
            pass
    return ts_start, ts_end


async def db_get_stats(recruiter_id: str, start_date: str | None = None, end_date: str | None = None) -> dict:
    ts_start, ts_end = _parse_date_range(start_date, end_date)
    try:
        async with async_session() as session:
            base = select(SessionModel).where(SessionModel.recruiter_id == recruiter_id)
            if ts_start is not None:
                base = base.where(SessionModel.created_at >= ts_start)
            if ts_end is not None:
                base = base.where(SessionModel.created_at < ts_end)

            all_sessions = await session.execute(base)
            rows = all_sessions.scalars().all()

            total = len(rows)
            status_bk: dict[str, int] = {}
            completed_count = 0
            total_duration = 0.0
            duration_count = 0
            for r in rows:
                status_bk[r.status] = status_bk.get(r.status, 0) + 1
                if r.status == "completed":
                    completed_count += 1
                if r.ended_at and r.created_at:
                    total_duration += r.ended_at - r.created_at
                    duration_count += 1

            candidates_result = await session.execute(
                select(func.count(CandidateModel.id))
            )
            total_candidates = candidates_result.scalar() or 0

            jobs_result = await session.execute(
                select(func.count(JobPostingModel.id)).where(JobPostingModel.recruiter_id == recruiter_id)
            )
            total_jobs = jobs_result.scalar() or 0

            open_jobs_result = await session.execute(
                select(func.count(JobPostingModel.id)).where(
                    JobPostingModel.recruiter_id == recruiter_id,
                    JobPostingModel.status == "active",
                )
            )
            open_jobs = open_jobs_result.scalar() or 0

            now = time.time()
            week_ago = now - 7 * 86400
            sessions_this_week = sum(1 for r in rows if r.created_at and r.created_at >= week_ago)

            return {
                "total_sessions": total,
                "total_candidates": total_candidates,
                "total_jobs": total_jobs,
                "open_jobs": open_jobs,
                "active_sessions": status_bk.get("active", 0) + status_bk.get("READY", 0),
                "status_breakdown": status_bk,
                "completed_count": completed_count,
                "completion_rate": round(completed_count / total, 4) if total > 0 else 0,
                "avg_duration_seconds": round(total_duration / duration_count, 1) if duration_count > 0 else 0,
                "sessions_this_week": sessions_this_week,
            }
    except Exception as e:
        print(f"[db] Failed to get stats: {e}")
        return {}


async def db_get_trends(recruiter_id: str, start_date: str | None = None, end_date: str | None = None, granularity: str = "day") -> list[dict]:
    ts_start, ts_end = _parse_date_range(start_date, end_date)
    try:
        async with async_session() as session:
            base = select(SessionModel).where(SessionModel.recruiter_id == recruiter_id)
            if ts_start is not None:
                base = base.where(SessionModel.created_at >= ts_start)
            if ts_end is not None:
                base = base.where(SessionModel.created_at < ts_end)

            result = await session.execute(base)
            rows = result.scalars().all()

            buckets: dict[str, dict[str, int]] = {}
            for r in rows:
                if not r.created_at:
                    continue
                dt = datetime.fromtimestamp(r.created_at)
                key = dt.strftime("%Y-%m-%d") if granularity == "day" else dt.strftime("%Y-W%V")
                if key not in buckets:
                    buckets[key] = {"total": 0, "completed": 0}
                buckets[key]["total"] += 1
                if r.status == "completed":
                    buckets[key]["completed"] += 1

            sorted_keys = sorted(buckets.keys())
            return [
                {"date": k, "total": buckets[k]["total"], "completed": buckets[k]["completed"]}
                for k in sorted_keys
            ]
    except Exception as e:
        print(f"[db] Failed to get trends: {e}")
        return []


async def db_create_session(
    session_id: str,
    jd: str = "",
    resume: str = "",
    rubric: str = "",
    enforcement_config: dict | None = None,
    demo_mode: bool = True,
    recruiter_id: str | None = None,
    candidate_email: str | None = None,
    job_id: str | None = None,
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
                job_id=job_id,
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


async def db_get_sessions_by_recruiter(
    recruiter_id: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    ts_start, ts_end = _parse_date_range(start_date, end_date)
    try:
        async with async_session() as session:
            stmt_base = select(
                SessionModel.id,
                SessionModel.candidate_name,
                SessionModel.status,
                SessionModel.created_at,
                SessionModel.ended_at,
                SessionModel.job_id,
                func.count(EventModel.id).label("violation_count"),
            ).outerjoin(
                EventModel, (EventModel.session_id == SessionModel.id) & (EventModel.event_type == "INTEGRITY_VIOLATION")
            ).where(
                SessionModel.recruiter_id == recruiter_id
            )

            if ts_start is not None:
                stmt_base = stmt_base.where(SessionModel.created_at >= ts_start)
            if ts_end is not None:
                stmt_base = stmt_base.where(SessionModel.created_at < ts_end)

            count_stmt = select(func.count()).select_from(
                stmt_base.group_by(SessionModel.id).subquery()
            )
            total_result = await session.execute(count_stmt)
            total = total_result.scalar() or 0

            stmt = stmt_base.group_by(SessionModel.id).order_by(SessionModel.created_at.desc()).limit(limit).offset(offset)
            result = await session.execute(stmt)
            rows = result.all()

            return {
                "sessions": [
                    {
                        "id": r.id,
                        "candidate_name": r.candidate_name,
                        "status": r.status,
                        "created_at": r.created_at,
                        "ended_at": r.ended_at,
                        "job_id": r.job_id,
                        "duration_seconds": round(r.ended_at - r.created_at, 1) if r.ended_at and r.created_at else None,
                        "violation_count": r.violation_count or 0,
                    }
                    for r in rows
                ],
                "total": total,
                "limit": limit,
                "offset": offset,
            }
    except Exception as e:
        print(f"[db] Failed to get sessions for recruiter {recruiter_id}: {e}")
        return {"sessions": [], "total": 0, "limit": limit, "offset": offset}


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


async def db_update_candidate_name(session_id: str, candidate_name: str) -> None:
    try:
        async with async_session() as session:
            await session.execute(
                update(SessionModel)
                .where(SessionModel.id == session_id)
                .values(candidate_name=candidate_name)
            )
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to update candidate_name for session {session_id}: {e}")


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


async def db_create_candidate(data: dict, recruiter_id: str | None = None) -> str:
    try:
        async with async_session() as session:
            candidate = CandidateModel(
                recruiter_id=recruiter_id,
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                email=data.get("email"),
                phone=data.get("phone"),
                linkedin_url=data.get("linkedin_url"),
                github_url=data.get("github_url"),
                skills=data.get("skills", []),
                experience=data.get("experience", []),
                education=data.get("education", []),
                summary=data.get("summary", ""),
                raw_resume_text=data.get("raw_resume_text", ""),
                original_filename=data.get("original_filename"),
            )
            session.add(candidate)
            await session.commit()
            return candidate.id
    except Exception as e:
        print(f"[db] Failed to create candidate: {e}")
        raise


async def db_list_candidates(recruiter_id: str | None = None) -> list[dict]:
    try:
        async with async_session() as session:
            q = select(CandidateModel).order_by(CandidateModel.created_at.desc())
            if recruiter_id is not None:
                q = q.where(CandidateModel.recruiter_id == recruiter_id)
            result = await session.execute(q)
            rows = result.scalars().all()
            return [
                {
                    "id": r.id,
                    "first_name": r.first_name,
                    "last_name": r.last_name,
                    "email": r.email,
                    "phone": r.phone,
                    "linkedin_url": r.linkedin_url,
                    "github_url": r.github_url,
                    "skills": r.skills,
                    "experience": r.experience,
                    "education": r.education,
                    "summary": r.summary,
                    "raw_resume_text": r.raw_resume_text,
                    "original_filename": r.original_filename,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[db] Failed to list candidates: {e}")
        return []


async def db_get_candidate(candidate_id: str) -> dict | None:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(CandidateModel).where(CandidateModel.id == candidate_id)
            )
            r = result.scalar_one_or_none()
            if not r:
                return None
            return {
                "id": r.id,
                "recruiter_id": r.recruiter_id,
                "first_name": r.first_name,
                "last_name": r.last_name,
                "email": r.email,
                "phone": r.phone,
                "linkedin_url": r.linkedin_url,
                "github_url": r.github_url,
                "skills": r.skills,
                "experience": r.experience,
                "education": r.education,
                "summary": r.summary,
                "raw_resume_text": r.raw_resume_text,
                "original_filename": r.original_filename,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
    except Exception as e:
        print(f"[db] Failed to get candidate {candidate_id}: {e}")
        return None


async def db_create_job(recruiter_id: str, data: dict) -> str:
    try:
        async with async_session() as session:
            job = JobPostingModel(
                recruiter_id=recruiter_id,
                title=data["title"],
                department=data.get("department"),
                location=data.get("location"),
                employment_type=data.get("employment_type", "Full-time"),
                description=data.get("description", ""),
                requirements=data.get("requirements", ""),
                required_skills=data.get("required_skills", []),
                status=data.get("status", "draft"),
                deadline=data.get("deadline"),
            )
            session.add(job)
            await session.commit()
            return job.id
    except Exception as e:
        print(f"[db] Failed to create job: {e}")
        raise


async def db_list_jobs(recruiter_id: str, status: str | None = None, search: str | None = None) -> list[dict]:
    try:
        async with async_session() as session:
            stmt = select(
                JobPostingModel,
                func.count(SessionModel.id).label("applicant_count"),
            ).outerjoin(
                SessionModel, SessionModel.job_id == JobPostingModel.id
            ).where(
                JobPostingModel.recruiter_id == recruiter_id
            ).group_by(JobPostingModel.id)

            if status:
                stmt = stmt.where(JobPostingModel.status == status)
            if search:
                stmt = stmt.where(JobPostingModel.title.ilike(f"%{search}%"))

            stmt = stmt.order_by(JobPostingModel.created_at.desc())
            result = await session.execute(stmt)
            rows = result.all()
            return [
                {
                    "id": r.JobPosting.id,
                    "recruiter_id": r.JobPosting.recruiter_id,
                    "title": r.JobPosting.title,
                    "department": r.JobPosting.department,
                    "location": r.JobPosting.location,
                    "employment_type": r.JobPosting.employment_type,
                    "description": r.JobPosting.description,
                    "requirements": r.JobPosting.requirements,
                    "required_skills": r.JobPosting.required_skills,
                    "status": r.JobPosting.status,
                    "deadline": r.JobPosting.deadline.isoformat() if r.JobPosting.deadline else None,
                    "applicant_count": r.applicant_count or 0,
                    "created_at": r.JobPosting.created_at.isoformat() if r.JobPosting.created_at else None,
                    "updated_at": r.JobPosting.updated_at.isoformat() if r.JobPosting.updated_at else None,
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[db] Failed to list jobs: {e}")
        return []


async def db_get_job(job_id: str) -> dict | None:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(
                    JobPostingModel,
                    func.count(SessionModel.id).label("applicant_count"),
                ).outerjoin(
                    SessionModel, SessionModel.job_id == JobPostingModel.id
                ).where(
                    JobPostingModel.id == job_id
                ).group_by(JobPostingModel.id)
            )
            row = result.one_or_none()
            if not row:
                return None
            r = row.JobPosting
            return {
                "id": r.id,
                "recruiter_id": r.recruiter_id,
                "title": r.title,
                "department": r.department,
                "location": r.location,
                "employment_type": r.employment_type,
                "description": r.description,
                "requirements": r.requirements,
                "required_skills": r.required_skills,
                "status": r.status,
                "deadline": r.deadline.isoformat() if r.deadline else None,
                "applicant_count": row.applicant_count or 0,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
    except Exception as e:
        print(f"[db] Failed to get job {job_id}: {e}")
        return None


async def db_update_job(job_id: str, data: dict) -> bool:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(JobPostingModel).where(JobPostingModel.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                return False
            for key in ("title", "department", "location", "employment_type", "description",
                        "requirements", "required_skills", "status", "deadline"):
                if key in data:
                    setattr(job, key, data[key])
            job.updated_at = datetime.utcnow()
            await session.commit()
            return True
    except Exception as e:
        print(f"[db] Failed to update job {job_id}: {e}")
        return False


async def db_delete_job(job_id: str) -> bool:
    try:
        async with async_session() as session:
            result = await session.execute(
                select(JobPostingModel).where(JobPostingModel.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                return False
            await session.execute(
                update(SessionModel).where(SessionModel.job_id == job_id).values(job_id=None)
            )
            await session.delete(job)
            await session.commit()
            return True
    except Exception as e:
        print(f"[db] Failed to delete job {job_id}: {e}")
        return False


async def db_update_job_status(job_id: str, status: str) -> bool:
    try:
        async with async_session() as session:
            result = await session.execute(
                update(JobPostingModel).where(JobPostingModel.id == job_id).values(
                    status=status, updated_at=datetime.utcnow()
                )
            )
            await session.commit()
            return result.rowcount > 0
    except Exception as e:
        print(f"[db] Failed to update job status {job_id}: {e}")
        return False


async def db_save_candidate_matches(job_id: str, matches: list[dict]) -> None:
    try:
        async with async_session() as session:
            existing = await session.execute(
                select(CandidateJobMatchModel).where(CandidateJobMatchModel.job_id == job_id)
            )
            for row in existing.scalars().all():
                await session.delete(row)
            await session.flush()

            for m in matches:
                match = CandidateJobMatchModel(
                    job_id=job_id,
                    candidate_id=m["candidate_id"],
                    score=m.get("score", 0),
                    rank=m.get("rank", 0),
                    strengths=m.get("strengths", []),
                    gaps=m.get("gaps", []),
                    reasoning=m.get("reasoning", ""),
                    model_used="gpt-4o-mini",
                )
                session.add(match)
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to save candidate matches for job {job_id}: {e}")


async def db_get_cached_matches(job_id: str, max_age_hours: int = 1) -> list[dict] | None:
    try:
        async with async_session() as session:
            cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
            result = await session.execute(
                select(CandidateJobMatchModel)
                .where(CandidateJobMatchModel.job_id == job_id)
                .where(CandidateJobMatchModel.created_at >= cutoff)
                .order_by(CandidateJobMatchModel.score.desc())
            )
            rows = result.scalars().all()
            if not rows:
                return None
            return [
                {
                    "candidate_id": r.candidate_id,
                    "score": r.score,
                    "rank": r.rank,
                    "strengths": r.strengths,
                    "gaps": r.gaps,
                    "reasoning": r.reasoning,
                    "model_used": r.model_used,
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[db] Failed to get cached matches for job {job_id}: {e}")
        return None


async def db_get_candidates_with_performance(recruiter_id: str | None = None) -> list[dict]:
    try:
        async with async_session() as session:
            q = select(CandidateModel).order_by(CandidateModel.created_at.desc())
            if recruiter_id is not None:
                q = q.where(CandidateModel.recruiter_id == recruiter_id)
            result = await session.execute(q)
            rows = result.scalars().all()

            candidates_list = []
            for r in rows:
                scores = []
                sessions_result = await session.execute(
                    select(SessionModel)
                    .where(SessionModel.candidate_email == r.email)
                    .where(SessionModel.report_json.isnot(None))
                )
                for s in sessions_result.scalars().all():
                    report = s.report_json or {}
                    verdict = report.get("final_recommendation", "")
                    scores.append(verdict)

                candidates_list.append({
                    "id": r.id,
                    "first_name": r.first_name,
                    "last_name": r.last_name,
                    "email": r.email,
                    "phone": r.phone,
                    "skills": r.skills,
                    "experience": r.experience,
                    "education": r.education,
                    "summary": r.summary,
                    "raw_resume_text": r.raw_resume_text,
                    "past_scores": ", ".join(scores) if scores else "",
                })
            return candidates_list
    except Exception as e:
        print(f"[db] Failed to get candidates with performance: {e}")
        return []


async def db_create_google_user(
    email: str,
    hashed_password: str,
    full_name: str = "",
    avatar_url: str = ""
) -> str:
    """
    Create new user from Google OAuth.
    Sets auth_provider='google' and email_verified=True.
    Returns user_id.
    """
    try:
        async with async_session() as session:
            user = UserModel(
                email=email,
                hashed_password=hashed_password,
                auth_provider="google",
                email_verified=True,
                full_name=full_name,
                avatar_url=avatar_url,
            )
            session.add(user)
            await session.commit()
            return user.id
    except Exception as e:
        print(f"[db] Failed to create Google user {email}: {e}")
        raise


async def db_update_user_google(
    user_id: str,
    full_name: str,
    avatar_url: str
) -> None:
    """
    Update Google profile fields for existing user.
    Called when existing email/password user signs in via Google.
    """
    try:
        async with async_session() as session:
            await session.execute(
                update(UserModel)
                .where(UserModel.id == user_id)
                .values(full_name=full_name, avatar_url=avatar_url)
            )
            await session.commit()
    except Exception as e:
        print(f"[db] Failed to update Google profile for user {user_id}: {e}")
