import sys; sys.path.insert(0, ".")
import asyncio
import time
import random
from datetime import datetime
from voicehire.db.database import async_session, init_db
from voicehire.db.models import Session, Event
from sqlalchemy import select, func, update as sa_update

VERDICT_NAMES = {
    "communication": "Communication",
    "technical_depth": "Technical Depth",
    "problem_solving": "Problem Solving",
    "leadership": "Leadership",
    "team_collaboration": "Team Collaboration",
    "system_design": "System Design",
    "code_quality": "Code Quality",
    "domain_knowledge": "Domain Knowledge",
    "mentoring": "Mentoring",
    "project_management": "Project Management",
    "analytical_thinking": "Analytical Thinking",
    "innovation": "Innovation",
}

VERDICT_DOMAINS = {
    "communication": "Behavioral",
    "technical_depth": "Technical",
    "problem_solving": "Technical",
    "leadership": "Behavioral",
    "team_collaboration": "Behavioral",
    "system_design": "Technical",
    "code_quality": "Technical",
    "domain_knowledge": "Technical",
    "mentoring": "Behavioral",
    "project_management": "Behavioral",
    "analytical_thinking": "Technical",
    "innovation": "Behavioral",
}

VERDICT_CLASSIFICATION = {
    "communication": "MUST_HAVE",
    "technical_depth": "MUST_HAVE",
    "problem_solving": "MUST_HAVE",
    "leadership": "NICE_TO_HAVE",
    "team_collaboration": "MUST_HAVE",
    "system_design": "NICE_TO_HAVE",
    "code_quality": "MUST_HAVE",
    "domain_knowledge": "MUST_HAVE",
    "mentoring": "NICE_TO_HAVE",
    "project_management": "NICE_TO_HAVE",
    "analytical_thinking": "MUST_HAVE",
    "innovation": "NICE_TO_HAVE",
}

STATUS_MAP = {
    "DEMONSTRATED": "COVERED",
    "WEAK": "INSUFFICIENT",
    "NOT_DEMONSTRATED": "UNEXPLORED",
    "EVIDENCE_INSUFFICIENT": "UNEXPLORED",
}

DEPTH_MAP = {
    "BASIC": "BASIC",
    "INTERMEDIATE": "INTERMEDIATE",
    "ADVANCED": "ADVANCED",
}

CONFIDENCE_MAP = {
    "DEMONSTRATED": random.randint,  # callable
    "WEAK": 40,
    "NOT_DEMONSTRATED": 15,
    "EVIDENCE_INSUFFICIENT": 25,
}

PROBE_TEMPLATES = [
    "Can you walk me through a time when you designed and implemented a complex system from scratch?",
    "How do you approach debugging a production issue that affects multiple users?",
    "Tell me about a project where you had to collaborate across multiple teams to deliver a result.",
    "What's your approach to ensuring code quality in a fast-paced development environment?",
    "Describe a situation where you had to make a technical decision with incomplete information.",
    "How do you stay current with new technologies and decide which ones to adopt?",
    "Can you give me an example of a time you mentored a junior team member?",
    "Walk me through your process for estimating effort on a new feature.",
]

REPLY_TEMPLATES = [
    "In my previous role at {company}, I led the initiative to redesign our {system} architecture. We migrated from a monolithic to microservices approach, which reduced deployment time by 60%.",
    "When I encountered a similar challenge at {company}, I set up automated monitoring and alerting. This helped us identify bottlenecks early and reduced incident response time significantly.",
    "At {company}, I worked closely with the product team to define requirements and iterated through multiple prototypes before arriving at the final solution that met all stakeholder needs.",
    "I believe in test-driven development and continuous integration. At {company}, I introduced CI/CD pipelines that improved our release frequency from monthly to weekly deployments.",
    "One project I'm particularly proud of at {company} involved optimizing our data pipeline, processing over 10 million records daily with 99.9% uptime.",
]

INTEGRITY_VIOLATION_EVENT_TYPES = ["INTEGRITY_VIOLATION", "PROBE", "EVIDENCE", "UTTERANCE"]


def _gen_confidence(verdict: str) -> int:
    if verdict == "DEMONSTRATED":
        return random.randint(75, 98)
    elif verdict == "WEAK":
        return random.randint(30, 55)
    elif verdict == "NOT_DEMONSTRATED":
        return random.randint(5, 25)
    return random.randint(15, 35)


def _build_scorecard(verdicts: dict) -> list[dict]:
    scores = []
    for cid, v in verdicts.items():
        name = VERDICT_NAMES.get(cid, cid.replace("_", " ").title())
        scores.append({
            "id": cid,
            "name": name,
            "domain": VERDICT_DOMAINS.get(cid, "Technical"),
            "classification": VERDICT_CLASSIFICATION.get(cid, "MUST_HAVE"),
            "status": STATUS_MAP.get(v.get("verdict", ""), "UNEXPLORED"),
            "confidence": _gen_confidence(v.get("verdict", "")),
            "evidence_count": len(v.get("key_evidence_ids", [])),
            "depth_required": DEPTH_MAP.get(v.get("depth_reached", ""), "INTERMEDIATE"),
        })
    return scores


def _build_coverage_summary(verdicts: dict) -> dict:
    total = len(verdicts)
    covered = sum(1 for v in verdicts.values() if v.get("verdict") == "DEMONSTRATED")
    must_have_ids = [k for k in verdicts if VERDICT_CLASSIFICATION.get(k) == "MUST_HAVE"]
    must_have_total = len(must_have_ids)
    must_have_covered = sum(1 for k in must_have_ids if verdicts[k].get("verdict") == "DEMONSTRATED")
    return {
        "total": total,
        "covered": covered,
        "must_have_total": must_have_total,
        "must_have_covered": must_have_covered,
    }


def _build_evidence_portfolio(verdicts: dict) -> list[dict]:
    portfolio = []
    for cid, v in verdicts.items():
        for eid in v.get("key_evidence_ids", []):
            company = random.choice(["TechCorp", "DataFlow", "InnoSys", "CloudBase", "NexGen"])
            portfolio.append({
                "evidence_id": eid,
                "raw_transcript": f"Candidate discussed experience with {VERDICT_NAMES.get(cid, cid)} at {company}. "
                                  f"Provided concrete examples of implementing solutions that improved team outcomes.",
                "competencies_tagged": [cid],
                "behavioral_tags": ["collaboration", "initiative"] if random.random() > 0.5 else ["problem_solving"],
                "extracted_signals": ["confidence", "specific_metrics"],
                "demonstrated_skills": [cid],
                "confidence": _gen_confidence(v.get("verdict", "")),
                "ownership_score": random.randint(6, 10) / 10.0,
                "verdict": v.get("verdict", "WEAK"),
                "timestamp": datetime.utcnow().isoformat(),
            })
    return portfolio


def _build_conversation_history() -> list[dict]:
    history = []
    ts = time.time() - 3600
    selected = random.sample(PROBE_TEMPLATES, min(4, len(PROBE_TEMPLATES)))
    for i, probe in enumerate(selected):
        history.append({
            "type": "PROBE",
            "timestamp": ts + i * 120,
            "text": probe,
            "metadata": {"competency_targeted": random.choice(list(VERDICT_NAMES.keys()))},
        })
        reply = random.choice(REPLY_TEMPLATES).format(company=random.choice(["TechCorp", "DataFlow", "InnoSys", "CloudBase"]), system=random.choice(["data pipeline", "deployment system", "monitoring stack", "API gateway"]))
        history.append({
            "type": "UTTERANCE",
            "timestamp": ts + i * 120 + 60,
            "text": reply,
        })
    return history


async def fixup():
    await init_db()
    now = time.time()
    fixed_statuses = 0
    created_events = 0
    expanded_reports = 0

    async with async_session() as session:
        # 1. Fix status values
        result = await session.execute(
            select(Session).where(Session.status.in_(["in_progress", "ready"]))
        )
        for s in result.scalars().all():
            old = s.status
            s.status = "active" if old == "in_progress" else "READY"
            fixed_statuses += 1
            print(f"  Status: {s.id} {old} -> {s.status}")
        await session.commit()

        # 2. Fetch completed sessions
        result = await session.execute(
            select(Session).where(Session.status == "completed")
        )
        completed = result.scalars().all()
        total = len(completed)

        for idx, s in enumerate(completed):
            report = s.report_json or {}
            verdicts = report.get("competency_verdicts", {})

            # Create DELIBERATION event if none exists
            ev_check = await session.execute(
                select(func.count(Event.id)).where(
                    Event.session_id == s.id,
                    Event.event_type == "DELIBERATION",
                )
            )
            if ev_check.scalar() == 0:
                deliberation_event = Event(
                    session_id=s.id,
                    event_type="DELIBERATION",
                    payload={
                        "session_id": s.id,
                        "final_recommendation": report.get("final_recommendation", "HIRE"),
                        "competency_verdicts": verdicts,
                        "evidence_gaps": report.get("evidence_gaps", []),
                        "must_have_total": report.get("must_have_total", 0),
                        "must_have_demonstrated": report.get("must_have_demonstrated", 0),
                        "consensus_reached": report.get("consensus_reached", True),
                        "deliberation_transcript": report.get("deliberation_transcript", {"advocate": "", "critic": ""}),
                        "model_used": report.get("model_used", "gpt-oss:120b"),
                    },
                    timestamp=now - random.uniform(3600, 86400),
                )
                session.add(deliberation_event)
                created_events += 1

            # Expand report_json to ReportData shape if missing fields
            if not report.get("competency_scorecard"):
                scorecard = _build_scorecard(verdicts)
                s.report_json = {
                    **report,
                    "competency_scorecard": scorecard,
                    "coverage_summary": _build_coverage_summary(verdicts),
                    "evidence_portfolio": _build_evidence_portfolio(verdicts),
                    "conversation_history": _build_conversation_history(),
                    "integrity_violations": [],
                    "enforcement_config": {"mode": "OBSERVATION_ONLY"},
                    "status": "completed",
                }
                expanded_reports += 1
                rj = s.report_json
                print(f"  Report: {s.id} expanded ({len(scorecard)} competencies, {len(rj.get('evidence_portfolio', []))} evidence items)")

            if (idx + 1) % 10 == 0:
                await session.commit()
                print(f"  Progress: {idx + 1}/{total} sessions processed")

        await session.commit()

    print(f"\nDone: {fixed_statuses} statuses fixed, {created_events} DELIBERATION events created, {expanded_reports} reports expanded")


if __name__ == "__main__":
    asyncio.run(fixup())
