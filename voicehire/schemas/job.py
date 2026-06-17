from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class JobCreate(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = "Full-time"
    description: Optional[str] = ""
    requirements: Optional[str] = ""
    required_skills: Optional[List[str]] = []
    deadline: Optional[datetime] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    required_skills: Optional[List[str]] = None
    deadline: Optional[datetime] = None


class JobResponse(BaseModel):
    id: str
    recruiter_id: str
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = "Full-time"
    description: str
    requirements: str
    required_skills: List[str] = []
    status: str
    deadline: Optional[str] = None
    applicant_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class JobStatusUpdate(BaseModel):
    status: str


class GenerateDescriptionRequest(BaseModel):
    job_title: str
    skills: List[str] = []


class GenerateDescriptionResponse(BaseModel):
    description: str
    requirements: str
