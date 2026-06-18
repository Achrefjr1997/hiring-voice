import os
import sys
import json
import time
import random
import asyncio
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from ollama import Client

OLLAMA_API_KEY = "e689d28330f846ac9fe667a06496d360.JGUXl5NNHf9VcDDegMQE_H4r"
TARGET_MODEL = "gpt-oss:120b"
CHECKPOINT_FILE = "seed_checkpoint.json"

REQUIRED_SCHEMA_VERSION = 1

JOB_TITLES = [
    "Software Engineer",
    "Machine Learning Engineer",
    "DevOps Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Data Scientist",
    "Security Analyst",
    "QA Engineer",
    "Product Manager",
    "Technical Writer",
]

DEPARTMENTS = ["Engineering", "Product", "Security", "Data", "Infrastructure", "Quality"]
LOCATIONS = ["San Francisco, CA", "New York, NY", "Austin, TX", "Remote", "London, UK", "Berlin, DE"]
EMPLOYMENT_TYPES = ["Full-time", "Contract", "Part-time"]

SKILL_POOL = [
    "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "C++", "Ruby",
    "React", "Vue.js", "Angular", "Next.js", "Node.js",
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform",
    "PostgreSQL", "MongoDB", "Redis", "Elasticsearch",
    "TensorFlow", "PyTorch", "scikit-learn", "LangChain", "OpenAI API",
    "CI/CD", "GitHub Actions", "Jenkins", "ArgoCD",
    "GraphQL", "REST API", "gRPC", "WebSocket",
    "System Design", "Microservices", "Event-Driven Architecture",
]

RECOMMENDATIONS = ["STRONG_HIRE", "HIRE", "NO_HIRE", "STRONG_NO_HIRE"]
VERDICTS = ["DEMONSTRATED", "WEAK", "NOT_DEMONSTRATED", "EVIDENCE_INSUFFICIENT"]

COMPETENCIES = [
    "communication", "technical_depth", "problem_solving", "leadership",
    "team_collaboration", "system_design", "code_quality", "domain_knowledge",
    "mentoring", "project_management", "analytical_thinking", "innovation",
]

ADVOCATE_TEMPLATES = [
    "The candidate demonstrated strong communication skills and technical depth during the interview. "
    "Their responses to probing questions showed clear understanding of system design principles. "
    "The evidence chain for competency '{comp}' was particularly strong, with multiple concrete examples provided.",
    "Strong performance across the board. The candidate's experience with {comp} was validated by "
    "real-world examples and measurable outcomes. Recommended for hire based on demonstrated competencies.",
    "Exceeded expectations in {comp} and related areas. The candidate provided detailed, "
    "well-structured responses with specific metrics and outcomes.",
]

CRITIC_TEMPLATES = [
    "While the candidate showed strengths in {comp}, there were notable gaps in demonstrated experience. "
    "Some responses lacked specificity and relied on hypothetical scenarios rather than past achievements. "
    "Additional probing would be needed to fully assess certain competencies.",
    "The candidate's performance was inconsistent. Areas of concern include insufficient depth in {comp}, "
    "lack of concrete examples for key competencies, and limited evidence of independent technical leadership.",
    "Several competencies were not adequately demonstrated. The evidence for {comp} was insufficient "
    "to make a confident assessment. Recommend additional interviews or technical assessments.",
]


def load_checkpoint() -> dict | None:
    if not os.path.exists(CHECKPOINT_FILE):
        return None
    with open(CHECKPOINT_FILE) as f:
        data = json.load(f)
    if data.get("schema_version") != REQUIRED_SCHEMA_VERSION:
        print(f"⚠️ Checkpoint schema mismatch, starting fresh")
        return None
    return data


def save_checkpoint(state: dict) -> None:
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["schema_version"] = REQUIRED_SCHEMA_VERSION
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(state, f, indent=2, default=str)


def verify_model(client: Client) -> None:
    print(f"🔍 Verifying model '{TARGET_MODEL}' is available...")
    response = client.list()
    available = [m["name"] for m in response.get("models", [])]
    if TARGET_MODEL not in available:
        raise ValueError(
            f"❌ '{TARGET_MODEL}' not found on Ollama Cloud!\n"
            f"   Available: {available}"
        )
    print(f"✅ Model '{TARGET_MODEL}' confirmed available\n")


def _generate_text(client: Client, prompt: str) -> str:
    chunks = []
    for part in client.chat(
        TARGET_MODEL,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        format="json",
    ):
        chunk = part.get("message", {}).get("content", "")
        if chunk:
            chunks.append(chunk)
    return "".join(chunks)


async def safe_generate(client: Client, prompt: str, max_retries: int = 5) -> dict:
    def _sync_call() -> str:
        return _generate_text(client, prompt)

    for attempt in range(max_retries):
        try:
            raw = await asyncio.to_thread(_sync_call)
            return json.loads(raw)
        except Exception as e:
            wait = min(2 ** attempt, 60)
            print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed: {e}. Waiting {wait}s...")
            await asyncio.sleep(wait)
    raise RuntimeError("Max retries exceeded for synthetic data generation")


JOB_PROMPT = """Generate a realistic job posting as VALID JSON ONLY.
NO markdown, NO explanations, NO code blocks. Just raw JSON.

Required schema:
{
  "title": "string (standard job title)",
  "department": "string",
  "location": "string (city, state or Remote)",
  "employment_type": "string (Full-time, Contract, or Part-time)",
  "description": "string (2-3 paragraphs describing the role, responsibilities, and team)",
  "requirements": "string (bullet-point style requirements, each on new line starting with -)",
  "required_skills": ["list of 5-8 relevant technical skills"]
}

Make it realistic for a mid-to-senior level position at a tech company."""


def build_candidate_prompt(batch_size: int = 10) -> str:
    return f"""Generate {batch_size} realistic software engineer/tech candidates as a VALID JSON ARRAY ONLY.
NO markdown, NO explanations, NO code blocks. Just raw JSON array.

Each candidate object must follow this schema:
{{
  "first_name": "string",
  "last_name": "string",
  "email": "unique@domain.com (MUST be unique across all candidates)",
  "phone": "string (US format)",
  "linkedin_url": "string (optional)",
  "github_url": "string (optional)",
  "skills": ["list of 5-10 technical skills"],
  "experience": [{{"company": "string", "title": "string", "years": int, "description": "string"}}],
  "education": [{{"school": "string", "degree": "string", "field": "string"}}],
  "summary": "string (2-3 sentence professional summary)",
  "raw_resume_text": "string (full resume text format with work history, skills, and education)"
}}

Make each candidate distinct — different backgrounds, skill levels, experience ranges.
Ensure ALL emails are unique across the entire batch. Use realistic domains like gmail.com, outlook.com, company.com."""


def build_session_report(session_id: str) -> dict:
    rec = random.choice(RECOMMENDATIONS)
    comps = random.sample(COMPETENCIES, random.randint(5, 8))
    comp_v = {}
    must_have_demonstrated = 0
    must_have_total = len(comps)
    for c in comps:
        v = random.choice(VERDICTS)
        flagged = random.random() < 0.08
        comp_v[c] = {
            "competency_id": c,
            "verdict": v,
            "key_evidence_ids": [f"ev_{random.randint(1, 99):03d}" for _ in range(random.randint(1, 3))],
            "depth_reached": random.choice(["BASIC", "INTERMEDIATE", "ADVANCED"]),
            "integrity_flagged": flagged,
        }
        if v == "DEMONSTRATED":
            must_have_demonstrated += 1

    chosen_comp = random.choice(comps)
    advocate = random.choice(ADVOCATE_TEMPLATES).format(comp=chosen_comp)
    critic = random.choice(CRITIC_TEMPLATES).format(comp=chosen_comp)

    return {
        "session_id": session_id,
        "final_recommendation": rec,
        "competency_verdicts": comp_v,
        "evidence_gaps": random.sample(
            [f"Insufficient evidence for {c}" for c in comps if comp_v[c]["verdict"] != "DEMONSTRATED"],
            k=min(3, sum(1 for c in comps if comp_v[c]["verdict"] != "DEMONSTRATED")),
        ),
        "must_have_total": must_have_total,
        "must_have_demonstrated": must_have_demonstrated,
        "consensus_reached": random.random() > 0.2,
        "deliberation_transcript": {"advocate": advocate, "critic": critic},
        "model_used": TARGET_MODEL,
    }


async def main() -> None:
    if not OLLAMA_API_KEY:
        print("❌ OLLAMA_API_KEY not set in .env")
        return

    client = Client(
        host="https://ollama.com",
        headers={"Authorization": "Bearer " + OLLAMA_API_KEY},
    )

    
    checkpoint = load_checkpoint()

    from voicehire.db.database import async_session, init_db
    from voicehire.db.models import User, JobPosting, Candidate, Session, CandidateJobMatch
    from voicehire.api.auth import hash_password
    from sqlalchemy import select

    await init_db()

    start_time = time.time()

    # ── Phase 2: Default Recruiter ──────────────────────────────────────
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == "demo@voicehire.ai"))
        demo_user = result.scalar_one_or_none()
        if not demo_user:
            demo_user = User(
                email="demo@voicehire.ai",
                hashed_password=hash_password("password123"),
            )
            session.add(demo_user)
            await session.commit()
            print("✅ Created demo recruiter: demo@voicehire.ai / password123")
        else:
            print("✅ Demo recruiter already exists")
        recruiter_id = demo_user.id

    # ── Phase 3: Jobs ──────────────────────────────────────────────────
    jobs_done = checkpoint.get("jobs_done", 0) if checkpoint else 0

    if jobs_done < len(JOB_TITLES):
        print("\n📋 Generating jobs...")
        for i in range(jobs_done, len(JOB_TITLES)):
            title = JOB_TITLES[i]
            result = await safe_generate(client, JOB_PROMPT)
            result["title"] = title
            async with async_session() as session:
                job = JobPosting(
                    recruiter_id=recruiter_id,
                    title=result["title"],
                    department=result.get("department", random.choice(DEPARTMENTS)),
                    location=result.get("location", random.choice(LOCATIONS)),
                    employment_type=result.get("employment_type", random.choice(EMPLOYMENT_TYPES)),
                    description=result.get("description", ""),
                    requirements=result.get("requirements", ""),
                    required_skills=result.get("required_skills", random.sample(SKILL_POOL, 5)),
                    status=random.choice(["active", "active", "active", "draft"]),
                )
                session.add(job)
                await session.commit()
            print(f"   ✅ Job {i + 1}/{len(JOB_TITLES)}: {title}")
            save_checkpoint({"jobs_done": i + 1, "candidates_done": 0, "sessions_done": 0})
    else:
        print(f"📋 Jobs already generated ({len(JOB_TITLES)}/{len(JOB_TITLES)})")

    # ── Phase 4: Candidates ────────────────────────────────────────────
    total_candidates = 100
    batch_size = 10
    candidates_done = checkpoint.get("candidates_done", 0) if checkpoint else 0

    if candidates_done < total_candidates:
        print(f"\n👤 Generating candidates ({total_candidates} total)...")

        async with async_session() as session:
            existing_emails_result = await session.execute(select(Candidate.email))
            existing_emails = {row[0] for row in existing_emails_result if row[0]}

        all_seen_emails = set(existing_emails)

        for start_idx in range(candidates_done, total_candidates, batch_size):
            remaining = total_candidates - start_idx
            current_batch = min(batch_size, remaining)
            prompt = build_candidate_prompt(current_batch)
            result = await safe_generate(client, prompt)

            candidates = result if isinstance(result, list) else result.get("candidates", [result])
            async with async_session() as session:
                for c in candidates:
                    email = c.get("email", f"candidate{start_idx}@example.com")
                    if email in all_seen_emails:
                        local, domain = email.rsplit("@", 1) if "@" in email else (email, "fixme.com")
                        suffix = 1
                        while f"{local}+{suffix}@{domain}" in all_seen_emails:
                            suffix += 1
                        email = f"{local}+{suffix}@{domain}"
                        c["email"] = email
                    all_seen_emails.add(email)

                    candidate = Candidate(
                        first_name=c.get("first_name", ""),
                        last_name=c.get("last_name", ""),
                        email=c.get("email", f"candidate{start_idx}@example.com"),
                        phone=c.get("phone", ""),
                        linkedin_url=c.get("linkedin_url", ""),
                        github_url=c.get("github_url", ""),
                        skills=c.get("skills", []),
                        experience=c.get("experience", []),
                        education=c.get("education", []),
                        summary=c.get("summary", ""),
                        raw_resume_text=c.get("raw_resume_text", ""),
                    )
                    session.add(candidate)
                await session.commit()

            count = start_idx + len(candidates)
            elapsed = time.time() - start_time
            print(f"   ✅ {count}/{total_candidates} candidates ({elapsed / 60:.1f}m elapsed)")
            save_checkpoint({"jobs_done": len(JOB_TITLES), "candidates_done": count, "sessions_done": 0})
    else:
        print(f"👤 Candidates already generated ({total_candidates}/{total_candidates})")

    # ── Phase 5: Sessions ──────────────────────────────────────────────
    total_sessions = 100
    sessions_done = checkpoint.get("sessions_done", 0) if checkpoint else 0

    if sessions_done < total_sessions:
        print(f"\n📝 Generating sessions ({total_sessions} total)...")

        async with async_session() as session:
            jobs_result = await session.execute(select(JobPosting))
            all_jobs = jobs_result.scalars().all()

            candidates_result = await session.execute(select(Candidate))
            all_candidates = candidates_result.scalars().all()

        if not all_jobs:
            print("❌ No jobs found — cannot create sessions")
            return
        if not all_candidates:
            print("❌ No candidates found — cannot create sessions")
            return

        for i in range(sessions_done, total_sessions):
            job = random.choice(all_jobs)
            cand = random.choice(all_candidates)

            sid = f"seed_{i:04d}"

            async with async_session() as check_session:
                already = await check_session.execute(select(Session).where(Session.id == sid))
                if already.scalar_one_or_none():
                    if (i + 1) % 10 == 0:
                        print(f"   ⏩ Session {i + 1}/{total_sessions} already exists, skipping...")
                    continue

            if i < 50:
                status = "completed"
            elif i < 80:
                status = random.choice(["active", "active", "in_progress"])
            else:
                status = random.choice(["READY", "ready"])

            sid = f"seed_{i:04d}"
            report = build_session_report(sid) if status == "completed" else None
            created_ts = datetime.now(timezone.utc).timestamp() - random.uniform(86400, 604800)

            async with async_session() as session:
                sess = Session(
                    id=sid,
                    recruiter_id=recruiter_id,
                    candidate_name=f"{cand.first_name} {cand.last_name}",
                    candidate_email=cand.email,
                    status=status,
                    demo_mode=True,
                    jd=job.description or "",
                    resume=cand.raw_resume_text or "",
                    job_id=job.id,
                    created_at=created_ts,
                    ended_at=datetime.now(timezone.utc).timestamp() if status == "completed" else None,
                    report_json=report,
                )
                session.add(sess)
                await session.commit()

            if (i + 1) % 10 == 0:
                elapsed = time.time() - start_time
                print(f"   ✅ {i + 1}/{total_sessions} sessions ({elapsed / 60:.1f}m elapsed)")
                save_checkpoint({
                    "jobs_done": len(JOB_TITLES),
                    "candidates_done": total_candidates,
                    "sessions_done": i + 1,
                })

        save_checkpoint({
            "jobs_done": len(JOB_TITLES),
            "candidates_done": total_candidates,
            "sessions_done": total_sessions,
        })
    else:
        print(f"📝 Sessions already generated ({total_sessions}/{total_sessions})")

    elapsed = time.time() - start_time
    print(f"\n{'=' * 50}")
    print(f"✅ SEED COMPLETE")
    print(f"   Jobs:       {len(JOB_TITLES)}")
    print(f"   Candidates: {total_candidates}")
    print(f"   Sessions:   {total_sessions}")
    print(f"   Elapsed:    {elapsed / 60:.1f} minutes")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    asyncio.run(main())
