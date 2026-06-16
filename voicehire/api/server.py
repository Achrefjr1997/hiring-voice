import os
import sys
import uuid
import random
import json
import asyncio
import time
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from voicehire.band.session_factory import BandSessionFactory
from voicehire.band.event_listener import BandEventListener, AgentRegistry
from voicehire.agents.session_brain import SessionBrain
from voicehire.agents.rubric_synthesizer import RubricSynthesizer
from voicehire.agents.voice_persona import VoicePersona
from voicehire.agents.evidence_chain import EvidenceChain
from voicehire.agents.integrity_skeptic import IntegritySkeptic
from voicehire.agents.hiring_committee import HiringCommittee
from voicehire.voice.stt import transcribe
from voicehire.reports.report_generator import generate_report, generate_report_from_events
from voicehire.reports.pdf_generator import generate_pdf
from voicehire.db.database import init_db
from voicehire.db.operations import (
    db_create_session, db_insert_event, db_end_session, ROOM_TO_SESSION,
    db_create_user, db_get_user_by_email, db_get_sessions_by_recruiter, db_get_session_history,
    db_update_candidate_name,
)
from voicehire.api.auth import create_token, decode_token, hash_password, verify_password
from voicehire.email.sender import send_invite_email
from config import BAND_API_BASE, BAND_API_KEY, TTS_FORMAT

security = HTTPBearer(auto_error=False)

REQUIRED_ENV_VARS = [
    "AIMLAPI_KEY",
    "FEATHERLESS_KEY",
    "BRANDAPIKEY",
    "DEEPGRAM_KEY",
    "JWT_SECRET",
]


def validate_env() -> None:
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        msg = f"Missing required environment variables: {', '.join(missing)}"
        print(f"[env] FATAL: {msg}", flush=True)
        sys.exit(1)
    print("[env] All required environment variables present.", flush=True)


async def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not credentials:
        raise HTTPException(401, "Authentication required")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload["sub"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:80"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "audio_output")
# Docker bind mount at /app/audio_output takes priority (persists across rebuilds)
if os.path.isdir("/app/audio_output"):
    AUDIO_DIR = "/app/audio_output"
os.makedirs(AUDIO_DIR, exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

SESSIONS: dict[str, dict] = {}
factory = BandSessionFactory()
registry = AgentRegistry()
listener = BandEventListener(registry)
brain: SessionBrain | None = None

# Frontend WebSocket relay: session_id -> set[WebSocket]
frontend_ws: dict[str, set[WebSocket]] = {}
room_to_session: dict[str, str] = {}

async def _relay_to_frontend(room_id: str, event_type: str, payload: dict) -> None:
    session_id = room_to_session.get(room_id)
    if not session_id:
        return
    clients = frontend_ws.get(session_id, set())
    if not clients:
        return
    msg = json.dumps({
        "event": event_type,
        "topic": f"chat_room:{room_id}",
        **payload,
    })
    dead: set[WebSocket] = set()
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    if dead:
        clients -= dead


async def _agent_post(agent_token: str, path: str, json_body: dict) -> dict:
    async with httpx.AsyncClient(base_url=BAND_API_BASE, headers={
        "X-API-Key": agent_token, "Content-Type": "application/json",
    }) as client:
        r = await client.post(path, json=json_body)
        r.raise_for_status()
        return r.json()


async def _agent_post_event(agent_token: str, room_id: str, content: str) -> dict:
    async with httpx.AsyncClient(base_url=BAND_API_BASE, headers={
        "X-API-Key": agent_token, "Content-Type": "application/json",
    }) as client:
        r = await client.post(f"/agent/chats/{room_id}/events", json={
            "event": {"content": content, "message_type": "task"},
        })
        r.raise_for_status()
        return r.json()


async def _process_audio_background(
    audio_bytes: bytes,
    session_id: str,
    exploration_room_id: str,
    brain_id: str | None,
    filename: str | None = None,
    mime: str = "audio/webm",
) -> None:
    """Transcribe audio in background, then post clean text events to Band."""
    try:
        transcript = await transcribe(audio_bytes, mime)
    except Exception as e:
        print(f"[server] STT failed: {e}")
        return

    # Update conversation_history with audio_url
    if filename:
        try:
            if brain and hasattr(brain, 'conversation_history'):
                for entry in reversed(brain.conversation_history):
                    if entry.get("type") == "response" and not entry.get("audio_url"):
                        entry["audio_url"] = f"/audio/{filename}"
                        break
        except Exception as e:
            print(f"[server] Failed to update history audio_url: {e}")

    event_payload = {"text": transcript, "timestamp": time.time()}
    if filename:
        event_payload["audio_file"] = filename
    asyncio.create_task(db_insert_event(
        session_id, "UTTERANCE", event_payload,
    ))

    voice_token = os.environ["BAND_TOKEN_VOICE_PERSONA"]
    room = exploration_room_id

    try:
        await _agent_post_event(voice_token, room,
                                 f"CANDIDATE_UTTERANCE: {transcript}")
    except Exception as e:
        print(f"[server] Failed to post CANDIDATE_UTTERANCE event: {e}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_env()
    global brain
    voice_id = factory.get_agent_id("Voice Persona")
    chain_id = factory.get_agent_id("Evidence Chain")
    committee_id = factory.get_agent_id("Hiring Committee")
    brain_id = factory.get_agent_id("Session Brain")
    rubric_id = factory.get_agent_id("Rubric Synthesizer")
    skeptic_id = factory.get_agent_id("Integrity Skeptic")

    brain = SessionBrain(
        voice_id=voice_id or "",
        chain_id=chain_id or "",
        committee_id=committee_id or "",
    )
    rubric = RubricSynthesizer(brain_id=brain_id or "")
    voice = VoicePersona(brain_id=brain_id or "")
    chain = EvidenceChain(brain_id=brain_id or "", skeptic_id=skeptic_id or "")
    skeptic = IntegritySkeptic(brain_id=brain_id or "")
    committee = HiringCommittee(brain_id=brain_id or "")

    registry.register("session-brain", brain_id or "", brain)
    registry.register("rubric-synthesizer", rubric_id or "", rubric)
    registry.register("voice-persona", voice_id or "", voice)
    registry.register("evidence-chain", chain_id or "", chain)
    registry.register("integrity-skeptic", skeptic_id or "", skeptic)
    registry.register("hiring-committee", committee_id or "", committee)

    await listener.start()
    listener.relay_fn = _relay_to_frontend

    print("[server] Pre-generating filler TTS…")
    await voice.prefetch_fillers()

    await init_db()
    print("[server] Database initialized.")

    yield

    await listener.stop()


app.router.lifespan_context = lifespan


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/auth/register")
async def register(email: str = Form(...), password: str = Form(...)):
    if not email or not password:
        raise HTTPException(400, "Email and password required")
    existing = await db_get_user_by_email(email)
    if existing:
        raise HTTPException(409, "Email already registered")
    hashed = hash_password(password)
    user_id = await db_create_user(email, hashed)
    token = create_token(user_id, email)
    return {"token": token, "recruiter_id": user_id, "email": email}


@app.post("/auth/login")
async def login(email: str = Form(...), password: str = Form(...)):
    if not email or not password:
        raise HTTPException(400, "Email and password required")
    user = await db_get_user_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user.id, user.email)
    return {"token": token, "recruiter_id": user.id, "email": user.email}


@app.get("/sessions")
async def list_sessions(recruiter_id: str = Depends(require_user)):
    sessions = await db_get_sessions_by_recruiter(recruiter_id)
    return sessions


@app.get("/session/{id}/history")
async def get_session_history(id: str, recruiter_id: str = Depends(require_user)):
    history = await db_get_session_history(id)
    if not history:
        raise HTTPException(404, "Session not found")
    # Attach live violation count from in-memory if session is active
    mem_session = SESSIONS.get(id)
    if mem_session:
        live_violations = mem_session.get("integrity_violations", [])
        history["session"]["violation_count"] = len(live_violations)
        brain_fallback = brain and brain.coverage_map
    else:
        history["session"]["violation_count"] = 0
        brain_fallback = False

    if not history["report"]:
        report = await generate_report_from_events(id)
        if not report and brain_fallback:
            report = generate_report(brain)
            report["session_id"] = id
            report["integrity_violations"] = live_violations if mem_session else []
            report["enforcement_config"] = mem_session.get("enforcement_config", {}) if mem_session else {}
        if report:
            history["report"] = report
    return history


@app.post("/session/create")
async def create_session(
    recruiter_id: str = Depends(require_user),
    jd: str = Form(...),
    resume: str = Form(...),
    rubric: str = Form(default=""),
    role_level: str = Form(default="senior"),
    duration_minutes: int = Form(default=30),
    enforcement_level: str = Form(default="OBSERVATION_ONLY"),
    violation_threshold: int = Form(default=3),
    grace_period: int = Form(default=1),
    demo_mode: bool = Form(default=True),
    candidate_email: str = Form(default=""),
):
    session_id = uuid.uuid4().hex[:8]
    band_session = await asyncio.to_thread(factory.create_session, session_id)

    SESSIONS[session_id] = {
        "band_session": band_session,
        "status": "READY",
        "enforcement_config": {
            "level": enforcement_level,
            "threshold": violation_threshold,
            "grace_period": grace_period,
            "demo_mode": demo_mode,
        },
        "integrity_violations": [],
        "integrity_paused": False,
        "candidate_email": candidate_email or None,
    }

    await listener.subscribe_to_rooms([
        band_session.foundation_room_id,
        band_session.exploration_room_id,
        band_session.committee_room_id,
    ])

    room_to_session[band_session.foundation_room_id] = session_id
    room_to_session[band_session.exploration_room_id] = session_id
    room_to_session[band_session.committee_room_id] = session_id
    ROOM_TO_SESSION[band_session.foundation_room_id] = session_id
    ROOM_TO_SESSION[band_session.exploration_room_id] = session_id
    ROOM_TO_SESSION[band_session.committee_room_id] = session_id

    if brain:
        brain.foundation_room_id = band_session.foundation_room_id
        brain.exploration_room_id = band_session.exploration_room_id
        brain.committee_room_id = band_session.committee_room_id
        brain.session_id = session_id
        brain.set_duration(duration_minutes)

    brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
    rubric_id = factory.get_agent_id("Rubric Synthesizer")

    if rubric_id:
        content = f"@Rubric Synthesizer JD: {jd} | RESUME: {resume} | RUBRIC: {rubric} | LEVEL: {role_level}"
        await _agent_post(brain_token, f"/agent/chats/{band_session.foundation_room_id}/messages", {
            "message": {"content": content, "mentions": [{"id": rubric_id}]},
        })

    try:
        await db_create_session(
            session_id, jd=jd, resume=resume, rubric=rubric,
            enforcement_config={
                "level": enforcement_level,
                "threshold": violation_threshold,
                "grace_period": grace_period,
                "demo_mode": demo_mode,
            },
            demo_mode=demo_mode,
            recruiter_id=recruiter_id,
            candidate_email=candidate_email or None,
        )
    except Exception as e:
        print(f"[server] CRITICAL: Failed to create session {session_id}: {e}")

    return {
        "session_id": session_id,
        "foundation_room_id": band_session.foundation_room_id,
        "exploration_room_id": band_session.exploration_room_id,
        "committee_room_id": band_session.committee_room_id,
        "band_ws_url": band_session.ws_url,
        "band_api_key": BAND_API_KEY,
    }


@app.post("/session/{session_id}/audio")
async def submit_audio(session_id: str, audio: UploadFile = File(...)):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    band_session = session["band_session"]

    blob = await audio.read()
    mime = audio.content_type or "audio/webm"

    # Save audio blob to disk for report playback
    filename = f"{session_id}_{int(time.time())}.webm"
    file_path = os.path.join(AUDIO_DIR, filename)
    try:
        with open(file_path, "wb") as f:
            f.write(blob)
    except Exception as e:
        print(f"[server] Failed to save audio file: {e}")
        filename = None

    filler_url = None
    filler_files = [f for f in os.listdir(AUDIO_DIR)
                    if f.startswith("filler_") and f.endswith(f".{TTS_FORMAT}")]

    try:
        if filler_files:
            filler_url = f"/audio/{random.choice(filler_files)}"
    except Exception:
        pass

    brain_id = factory.get_agent_id("Session Brain")
    asyncio.create_task(_process_audio_background(
        blob, session_id, band_session.exploration_room_id, brain_id, filename, mime,
    ))

    return {"filler_url": filler_url}


@app.post("/session/{session_id}/end")
async def end_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        return {"error": "Session not found"}
    band_session = session["band_session"]

    brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
    try:
        await _agent_post_event(brain_token, band_session.exploration_room_id, "SESSION_END")
    except Exception as e:
        print(f"[server] end_session failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"[server] Response body: {e.response.text[:500]}")
    SESSIONS[session_id]["status"] = "ENDED"

    report_data = await generate_report_from_events(session_id)
    if not report_data and brain and brain.coverage_map:
        report_data = generate_report(brain)
        report_data["session_id"] = session_id
        report_data["status"] = "completed"
        report_data["integrity_violations"] = session.get("integrity_violations", [])
        report_data["enforcement_config"] = session.get("enforcement_config", {})
    try:
        await db_end_session(session_id, report_data)
    except Exception as e:
        print(f"[server] CRITICAL: Failed to end session {session_id}: {e}")

    return {"status": "ok"}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "status": session["status"],
        "candidate_name": session.get("candidate_name"),
        "demo_mode": session.get("enforcement_config", {}).get("demo_mode", True),
        "enforcement_level": session.get("enforcement_config", {}).get("level", "OBSERVATION_ONLY"),
    }


@app.post("/session/{session_id}/candidate")
async def set_candidate_name(session_id: str, first_name: str = Form(...), last_name: str = Form(...)):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    full = f"{first_name} {last_name}"
    session["candidate_name"] = full
    # Persist to DB (best-effort, must not block interview)
    try:
        await db_update_candidate_name(session_id, full)
    except Exception as e:
        print(f"[server] Failed to persist candidate_name to DB: {e}")
    band_session = session["band_session"]
    await _agent_post_event(
        os.environ["BAND_TOKEN_SESSION_BRAIN"],
        band_session.exploration_room_id,
        f"CANDIDATE_IDENTIFIED: {json.dumps({'first_name': first_name, 'last_name': last_name})}"
    )
    return {"ok": True, "candidate_name": full}


@app.post("/session/{session_id}/send-invite")
async def send_invite(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    candidate_email = session.get("candidate_email")
    candidate_name = session.get("candidate_name", "Candidate")
    if not candidate_email:
        raise HTTPException(400, "No candidate email set for this session")
    link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/interview/{session_id}"
    sent = await send_invite_email(candidate_email, candidate_name, link)
    if not sent:
        raise HTTPException(502, "Failed to send email")
    return {"ok": True, "sent": True}


@app.get("/session/{session_id}/competencies")
async def get_competency_summary(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    global brain
    if not brain or not brain.coverage_map:
        raise HTTPException(503, "Competency graph not ready — retrying")
    competencies = [
        {"name": c.name, "domain": c.domain, "classification": c.classification, "weight": c.weight}
        for c in brain.coverage_map.competencies.values()
    ]
    num_must = sum(1 for c in competencies if c["classification"] == "MUST_HAVE")
    return {
        "competencies": competencies,
        "estimated_duration": f"{max(15, num_must * 2)} minutes",
    }


@app.get("/session/{session_id}/report")
async def get_report(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    global brain
    if not brain or not brain.coverage_map:
        raise HTTPException(503, "Report not ready yet")
    report = generate_report(brain)
    report["session_id"] = session_id
    report["status"] = session.get("status")
    report["integrity_violations"] = session.get("integrity_violations", [])
    report["enforcement_config"] = session.get("enforcement_config", {})
    return report


@app.get("/session/{session_id}/pdf")
async def get_pdf(session_id: str):
    global brain
    session = SESSIONS.get(session_id)
    report = None
    decision = None
    deliberation_text = None
    history = None

    # Try in-memory first (live session)
    if session:
        report = generate_report(brain) if brain and brain.coverage_map else None
        try:
            history = await db_get_session_history(session_id)
        except Exception:
            pass
    else:
        # Fallback to DB-only (historical session)
        try:
            history = await db_get_session_history(session_id)
        except Exception:
            pass
        if not history:
            raise HTTPException(404, "Session not found")
        enf = history["session"].get("enforcement_config") or {}
        violations = [
            {
                "type": e["payload"].get("type", e["event_type"]),
                "timestamp": e["payload"].get("timestamp", e["timestamp"]),
                "severity": e["payload"].get("severity", "info"),
                "points": e["payload"].get("points", 0),
            }
            for e in history.get("events", [])
            if e["event_type"] == "INTEGRITY_VIOLATION"
        ]
        session = {
            "status": history["session"].get("status", "N/A"),
            "candidate_name": history["session"].get("candidate_name"),
            "candidate_email": history["session"].get("candidate_email"),
            "enforcement_config": enf,
            "integrity_violations": violations,
        }
        report = history.get("report")

    # Extract decision / deliberation from DB events
    if history:
        try:
            for ev in history.get("events", []):
                if ev["event_type"] == "DELIBERATION":
                    payload = ev["payload"]
                    if isinstance(payload, dict):
                        decision = payload
                        dt = payload.get("deliberation_transcript", {})
                        if dt:
                            deliberation_text = dt
                        break
        except Exception as e:
            print(f"[pdf] Failed to load deliberation from DB: {e}")

    pdf_bytes = generate_pdf(
        session_id=session_id,
        session_info=session,
        report=report,
        decision=decision,
        deliberation_text=deliberation_text,
    )
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="voicehire-report-{session_id}.pdf"'},
    )


@app.post("/session/{session_id}/finish")
async def candidate_finish(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    band_session = session["band_session"]
    await _agent_post_event(
        os.environ["BAND_TOKEN_SESSION_BRAIN"],
        band_session.exploration_room_id,
        "CANDIDATE_FINISHED:"
    )
    session["status"] = "CANDIDATE_FINISHED"

    asyncio.create_task(_auto_end_session(session_id))

    return {"ok": True}


async def _auto_end_session(session_id: str) -> None:
    await asyncio.sleep(5)
    session = SESSIONS.get(session_id)
    if not session or session.get("status") != "CANDIDATE_FINISHED":
        return
    band_session = session["band_session"]
    brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
    try:
        await _agent_post_event(brain_token, band_session.exploration_room_id, "SESSION_END")
    except Exception as e:
        print(f"[server] auto-end failed: {e}")
    SESSIONS[session_id]["status"] = "ENDED"
    report_data = await generate_report_from_events(session_id)
    if not report_data and brain and brain.coverage_map:
        report_data = generate_report(brain)
        report_data["session_id"] = session_id
        report_data["status"] = "completed"
        report_data["integrity_violations"] = session.get("integrity_violations", [])
        report_data["enforcement_config"] = session.get("enforcement_config", {})
    try:
        await db_end_session(session_id, report_data)
    except Exception as e:
        print(f"[server] CRITICAL: Failed to auto-end session {session_id}: {e}")


async def _relay_to_session(session_id: str, content: str) -> None:
    """Broadcast a content message to all frontend WS clients for a session."""
    msg = json.dumps({
        "event": "event_created",
        "topic": f"chat_room:{session_id}",
        "content": content,
        "sender_name": "@integrity-system",
        "inserted_at": datetime.utcnow().isoformat(),
    })
    for ws in frontend_ws.get(session_id, set()):
        try:
            await ws.send_text(msg)
        except Exception:
            pass


@app.post("/session/{session_id}/integrity-violation")
async def report_integrity_violation(session_id: str, violation: dict):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if "integrity_violations" not in session:
        session["integrity_violations"] = []
    session["integrity_violations"].append(violation)
    asyncio.create_task(db_insert_event(session_id, "INTEGRITY_VIOLATION", violation))
    await _relay_to_session(session_id, f"INTEGRITY_VIOLATION: {json.dumps(violation)}")
    config = session.get("enforcement_config", {})
    if config.get("demo_mode", True) or config.get("level") == "OBSERVATION_ONLY":
        return {"ok": True, "action": "logged_only"}
    recent = [v for v in session["integrity_violations"]
              if v.get("timestamp", 0) > (time.time() - 300) * 1000]
    total_score = sum(v.get("points", 1) for v in recent)
    threshold = config.get("threshold", 10)
    if total_score >= threshold and not session.get("integrity_paused"):
        session["integrity_paused"] = True
        await _relay_to_session(session_id, "INTEGRITY_PAUSED:")
    return {"ok": True, "action": "logged"}


@app.post("/session/{session_id}/integrity-resume")
async def resume_integrity(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session["integrity_paused"] = False
    await _relay_to_session(session_id, "INTEGRITY_RESUMED:")
    return {"ok": True}


@app.post("/session/{session_id}/integrity-terminate")
async def terminate_integrity(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session["integrity_paused"] = False
    await _relay_to_session(session_id, "INTEGRITY_TERMINATED:")

    report_data = await generate_report_from_events(session_id)
    if not report_data and brain and brain.coverage_map:
        report_data = generate_report(brain)
        report_data["session_id"] = session_id
        report_data["status"] = "completed"
        report_data["integrity_violations"] = session.get("integrity_violations", [])
        report_data["enforcement_config"] = session.get("enforcement_config", {})
    try:
        await db_end_session(session_id, report_data)
    except Exception as e:
        print(f"[server] CRITICAL: Failed to terminate session {session_id}: {e}")

    return {"ok": True}


@app.websocket("/ws/{session_id}")
async def ws_relay(ws: WebSocket, session_id: str):
    await ws.accept()
    if session_id not in frontend_ws:
        frontend_ws[session_id] = set()
    frontend_ws[session_id].add(ws)
    session = SESSIONS.get(session_id)
    # Notify once when candidate WS connects (not recruiter — guard via candidate_name + one-shot flag)
    if session and not session.get("candidate_connected_sent") and session.get("candidate_name"):
        session["candidate_connected_sent"] = True
        band_session = session["band_session"]
        await _agent_post_event(
            os.environ["BAND_TOKEN_SESSION_BRAIN"],
            band_session.exploration_room_id,
            "CANDIDATE_CONNECTED:"
        )
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        frontend_ws.get(session_id, set()).discard(ws)
        # Notify when last candidate WS disconnects while session active
        if (session
                and len(frontend_ws.get(session_id, set())) == 0
                and session.get("status") in ("READY", "active", "CANDIDATE_FINISHED")):
            band_session = session["band_session"]
            await _agent_post_event(
                os.environ["BAND_TOKEN_SESSION_BRAIN"],
                band_session.exploration_room_id,
                "CANDIDATE_DISCONNECTED:"
            )
            # Auto-end if candidate disconnected without clicking finish
            if session.get("status") != "CANDIDATE_FINISHED":
                session["status"] = "CANDIDATE_FINISHED"
                asyncio.create_task(_auto_end_session(session_id))
