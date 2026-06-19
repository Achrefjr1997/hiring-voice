import uuid
import time
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, Float, Text, ForeignKey, JSON, DateTime
from voicehire.db.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    auth_provider = Column(String(20), default="email", nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    full_name = Column(String(200), nullable=True)


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    candidate_name = Column(String, nullable=True)
    candidate_email = Column(String, nullable=True)
    status = Column(String, default="READY")
    enforcement_config = Column(JSON, default=dict)
    demo_mode = Column(Boolean, default=True)
    jd = Column(Text, default="")
    resume = Column(Text, default="")
    rubric = Column(Text, default="")
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True, index=True)
    created_at = Column(Float, default=time.time)
    ended_at = Column(Float, nullable=True)
    report_json = Column(JSON, nullable=True)


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    skills = Column(JSON, default=list)
    experience = Column(JSON, default=list)
    education = Column(JSON, default=list)
    summary = Column(Text, default="")
    raw_resume_text = Column(Text, default="")
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class JobPosting(Base):
    __tablename__ = "job_postings"
    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    employment_type = Column(String, default="Full-time")
    description = Column(Text, default="")
    requirements = Column(Text, default="")
    required_skills = Column(JSON, default=list)
    status = Column(String, default="draft")
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CandidateJobMatch(Base):
    __tablename__ = "candidate_job_matches"
    job_id = Column(String, ForeignKey("job_postings.id"), primary_key=True)
    candidate_id = Column(String, ForeignKey("candidates.id"), primary_key=True)
    score = Column(Float, default=0)
    rank = Column(Integer, default=0)
    strengths = Column(JSON, default=list)
    gaps = Column(JSON, default=list)
    reasoning = Column(Text, default="")
    model_used = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    payload = Column(JSON, default=dict)
    timestamp = Column(Float, default=time.time)
