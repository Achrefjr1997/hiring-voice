import os
import uuid
import random
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from config import BAND_API_BASE, BAND_API_KEY, TTS_FORMAT

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "audio_output")
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
    exploration_room_id: str,
    brain_id: str | None,
    mime: str = "audio/webm",
) -> None:
    """Transcribe audio in background, then post clean text events to Band."""
    try:
        transcript = await transcribe(audio_bytes, mime)
    except Exception as e:
        print(f"[server] STT failed: {e}")
        return

    voice_token = os.environ["BAND_TOKEN_VOICE_PERSONA"]
    room = exploration_room_id

    try:
        await _agent_post_event(voice_token, room,
                                 f"CANDIDATE_UTTERANCE: {transcript}")
    except Exception as e:
        print(f"[server] Failed to post CANDIDATE_UTTERANCE event: {e}")

    if brain_id:
        try:
            await _agent_post(voice_token, f"/agent/chats/{room}/messages", {
                "message": {
                    "content": f"@Session-brain UTTERANCE: {transcript}",
                    "mentions": [{"id": brain_id}],
                },
            })
        except Exception as e:
            print(f"[server] Failed to post directed UTTERANCE message: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    yield

    await listener.stop()


app.router.lifespan_context = lifespan


@app.post("/session/create")
async def create_session(
    jd: str = Form(...),
    resume: str = Form(...),
    rubric: str = Form(default=""),
    role_level: str = Form(default="senior"),
    duration_minutes: int = Form(default=30),
):
    session_id = uuid.uuid4().hex[:8]
    band_session = await asyncio.to_thread(factory.create_session, session_id)

    SESSIONS[session_id] = {
        "band_session": band_session,
        "status": "READY",
    }

    await listener.subscribe_to_rooms([
        band_session.foundation_room_id,
        band_session.exploration_room_id,
        band_session.committee_room_id,
    ])

    room_to_session[band_session.foundation_room_id] = session_id
    room_to_session[band_session.exploration_room_id] = session_id
    room_to_session[band_session.committee_room_id] = session_id

    if brain:
        brain.foundation_room_id = band_session.foundation_room_id
        brain.exploration_room_id = band_session.exploration_room_id
        brain.committee_room_id = band_session.committee_room_id
        brain.set_duration(duration_minutes)

    brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
    rubric_id = factory.get_agent_id("Rubric Synthesizer")

    if rubric_id:
        content = f"@Rubric Synthesizer JD: {jd} | RESUME: {resume} | RUBRIC: {rubric} | LEVEL: {role_level}"
        await _agent_post(brain_token, f"/agent/chats/{band_session.foundation_room_id}/messages", {
            "message": {"content": content, "mentions": [{"id": rubric_id}]},
        })

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
        blob, band_session.exploration_room_id, brain_id, mime,
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
    return {"status": "ok"}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "status": session["status"],
        "candidate_name": session.get("candidate_name"),
    }


@app.post("/session/{session_id}/candidate")
async def set_candidate_name(session_id: str, first_name: str = Form(...), last_name: str = Form(...)):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    full = f"{first_name} {last_name}"
    session["candidate_name"] = full
    band_session = session["band_session"]
    await _agent_post_event(
        os.environ["BAND_TOKEN_SESSION_BRAIN"],
        band_session.exploration_room_id,
        f"CANDIDATE_IDENTIFIED: {json.dumps({'first_name': first_name, 'last_name': last_name})}"
    )
    return {"ok": True, "candidate_name": full}


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
