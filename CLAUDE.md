# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

| Command | Purpose |
|---------|---------|
| `python scripts/run_server.py` | Start FastAPI backend (uvicorn on :8000) |
| `cd frontend && npm run dev` | Start React frontend (Vite on :5173) |
| `python scripts/register_agents.py` | One-time: Register 6 Band.ai agents, auto-populates .env tokens |
| `python scripts/smoke_test.py` | Verify all LLM API endpoints |
| `pytest tests/` | Run unit tests (11 coverage map tests) |
| `python scripts/stress_test.py` | 3-session concurrent stress test |
| `docker-compose up --build` | Run backend + frontend in containers |

**Prerequisites:** Python 3.12+, Node.js 20+, npm 10+. Required API keys: AI/ML API, Featherless AI, Deepgram, Band.ai (see .env.example).

## High-Level Architecture

VoiceHire is a multi-agent AI hiring platform that conducts real-time voice interviews with deterministic competency tracking.

### Technology Stack

**Backend:**
- FastAPI (Python 3.12) with SQLAlchemy 2.0 async ORM (SQLite)
- JWT authentication (HS256, 24h expiry)
- WebSocket relay for Band.ai Phoenix Channels events
- Deepgram API for STT (nova-2) + TTS (aura-2 voices)
- OpenAI SDK for multi-provider LLM calls (AI/ML API, Featherless AI)

**Frontend:**
- React 18 with TypeScript (strict mode)
- Vite 5 build tool
- Tailwind CSS v4
- Native WebSocket API for real-time session events
- MediaRecorder API for audio capture

**External Services:**
- **Band.ai**: Multi-agent chat rooms (3 rooms per session)
- **AI/ML API**: Premium models (DeepSeek V4 Pro, Qwen3 32B/235B, gpt-4o-mini)
- **Featherless AI**: Open-weight models (DeepSeek R1, Mistral 7B)
- **Deepgram**: Voice transcription + synthesis

### Multi-Agent System (6 Band.ai Agents)

**3 Rooms per Session:**

1. **Foundation Room** (rubric creation):
   - Session Brain (Qwen3 32B): Orchestrates interview flow, generates probes, manages CoverageMap
   - Rubric Synthesizer (DeepSeek V4 Pro): Extracts competency graph from job description + resume

2. **Exploration Room** (live interview):
   - Voice Persona: TTS tone management + audio delivery
   - Evidence Chain (gpt-4o-mini + Mistral 7B): Parallel technical + behavioral signal extraction
   - Integrity Skeptic (DeepSeek R1): Async confidence challenges (non-blocking)

3. **Committee Room** (post-interview):
   - Hiring Committee (Qwen3 235B A22B Thinking): 3-round deliberation (Advocate/Critic/Chair)

**Agent Communication Pattern:**
- Agents @mention each other via UUID (not handle strings) in `BandAgent.send_to_agent()`
- Events broadcast via `BandAgent.send_event()` (visible to all)
- Backend listens via `BandEventListener` (Phoenix Channels WebSocket)
- Events routed to agents via `AgentRegistry.route_event()`

### Critical System Components

**Competency Tracking (Pure Python, Deterministic):**
- `voicehire/competency/coverage_map.py`: No LLM randomness
- States: `UNEXPLORED` → `WEAK` → `COVERED` / `INSUFFICIENT` / `EXHAUSTED`
- Updates confidence via evidence signals + behavioral tags
- Applies skill implications (inferred competencies from demonstrated skills)
- Drives probe selection in Session Brain (always targets lowest-confidence MUST_HAVE)

**Session Flow:**
1. Recruiter creates job → Resume parsing → Job description generation
2. Candidate matching → Display ranked candidates
3. Invite candidate → Generate session via `BandSessionFactory.create_session()`
4. Creates 3 Band.ai rooms, returns session_id + room IDs + WebSocket URL
5. Candidate connects → Audio capture (MediaRecorder) → Deepgram STT
6. Session Brain generates probe → Voice Persona delivers via Deepgram TTS
7. Evidence Chain extracts signals → Integrity Skeptic challenges (async)
8. CoverageMap updates (pure Python, non-blocking frontend updates)
9. Post-interview: Hiring Committee deliberates → Produces HiringDecision JSON
10. Report generated + saved to `session.report_json`

**Data Models (SQLAlchemy):**
- Core entities: `users`, `sessions`, `candidates`, `job_postings`, `candidate_job_matches`, `events`
- Key event types (stored in `events.payload` JSON):
  - `COMPETENCY_GRAPH_READY`: Competency rubric
  - `PROBE_GENERATED`: Probe text + expected signals
  - `CANDIDATE_UTTERANCE`: Candidate response + transcript
  - `EVIDENCE`: Extracted technical/behavioral signals
  - `INTEGRITY_CHALLENGE`: Skeptic's confidence adjustment
  - `DELIBERATION`: Committee's final decision
  - `REPORT_READY`: Report JSON complete

### Key Directory Structure

```
voicehire/                          # Backend package
  ├── api/
  │   ├── server.py                 # Main FastAPI app (~30 routes)
  │   ├── auth.py                   # JWT token generation/verification
  │   └── client.py                 # LLM client wrappers (AIMLAPIClient, FeatherlessClient)
  ├── agents/                       # 6 Band.ai agents
  │   ├── session_brain.py          # Orchestrator (Qwen3 32B)
  │   ├── rubric_synthesizer.py     # Competency extraction (DeepSeek V4 Pro)
  │   ├── voice_persona.py          # Tone + TTS delivery
  │   ├── evidence_chain.py         # Signal extraction (gpt-4o-mini + Mistral 7B)
  │   ├── integrity_skeptic.py      # Async challenges (DeepSeek R1)
  │   └── hiring_committee.py       # Final deliberation (Qwen3 235B)
  ├── band/
  │   ├── session_factory.py        # Creates 3 Band rooms per session
  │   ├── agent_base.py             # Abstract base for all agents
  │   └── event_listener.py         # Phoenix Channels WebSocket listener
  ├── competency/
  │   ├── coverage_map.py           # Deterministic competency tracking (NO LLM)
  │   └── graph_models.py           # Competency data structures
  ├── services/
  │   ├── resume_parser.py          # Structured JSON extraction from resumes
  │   ├── job_ai_generator.py       # Job description generation from title+skills
  │   └── candidate_matcher.py      # Candidate-to-job ranking algorithm
  ├── voice/
  │   ├── stt.py                    # Deepgram STT (nova-2)
  │   └── tts.py                    # Deepgram TTS (aura-2)
  └── db/
      ├── database.py               # SQLAlchemy async engine
      ├── models.py                 # ORM models
      └── operations.py             # DB helper functions

frontend/src/
  ├── App.tsx                       # Main routing (login/dashboard/interview/report)
  ├── types.ts                      # TypeScript interfaces (CoverageMapState, HiringDecision, etc.)
  ├── components/
  │   ├── RecruiterDashboard.tsx    # Main recruiter interface
  │   ├── CandidateRoom.tsx         # Live interview interface
  │   ├── VoiceInterface.tsx        # Audio capture + playback (MediaRecorder)
  │   ├── ReportView.tsx            # Post-interview report display
  │   ├── CoverageMapViz.tsx        # Competency coverage visualization
  │   └── ...
  ├── hooks/
  │   ├── useBandSession.ts         # WebSocket connection + event parsing
  │   ├── useAudio.ts               # MediaRecorder audio capture
  │   └── useIntegrityCheck.ts      # Integrity violation tracking
  └── api/
      └── bandApi.ts                # API client functions

scripts/                            # Utility scripts
  ├── run_server.py                 # Start uvicorn backend
  ├── register_agents.py            # Band.ai agent registration
  ├── smoke_test.py                 # Verify LLM endpoints
  └── stress_test.py                # Performance testing
```

## Critical Architecture Patterns

### Band.ai Message Protocol
Agents @mention each other via UUID (not handle strings). Use `send_to_agent(agent_uuid, message)` for direct messages, `send_event(event_type, payload)` for broadcasts.

### Async Non-blocking Design
Integrity Skeptic runs as `asyncio.create_task()` — challenges arrive async, don't block probe generation. CoverageMap updates sent to frontend via `COVERAGE_MAP_UPDATE` events (non-blocking).

### Deterministic Coverage Tracking
`CoverageMap` class uses pure Python logic (weighted averages, thresholds) — reproducible, auditable, no LLM randomness. Always update via evidence signals, never regenerate from scratch.

### WebSocket Relay Architecture
Backend listens to Band's Phoenix Channels, relays to frontend via browser WebSocket (`/ws/{sessionId}`). Allows real-time UI updates without polling.

### Session Isolation
Each interview gets 3 Band.ai rooms (foundation/exploration/committee). Audio files stored with `session_id_timestamp` naming in `audio_output/`.

### Idempotency Guards
Session Brain checks `if self.coverage_map: return` to avoid re-processing competency graph. Always verify state before creating new resources.

### JSON Evidence Nodes
All evidence, probes, decisions serialized as JSON in DB events table — enables audit trail + report reconstruction via `report_generator.generate_report()`.

## Important Development Notes

**Model Selection (config.py):**
- Premium (AI/ML API): DeepSeek V4 Pro (rubric), Qwen3 32B (probe generation), Qwen3 235B (committee), gpt-4o-mini (resume/job/matcher)
- Open-weight (Featherless): DeepSeek R1 (integrity), Mistral 7B (behavioral evidence)

**Voice Configuration:**
- STT: Deepgram nova-2 (high accuracy, low latency)
- TTS: aura-2-thalia-en (fillers), aura-2-jupiter-en (probes)
- Filler audio pre-generated at server startup (5 files cached)

**Security:**
- JWT tokens expire in 24h (HS256 algorithm)
- Passwords hashed with bcrypt via passlib
- Integrity monitoring: client-side (browser tab focus, copy/paste) + server-side (DeepSeek R1 skepticism)
- Enforcement levels: `OBSERVATION_ONLY`, `WARNING_MODE`, `AUTO_TERMINATE`, `LOCKDOWN`

**Database:**
- SQLite for development, production-ready via async SQLAlchemy
- All events logged in `events` table with JSON payloads
- Foreign keys enforced, cascade deletes configured

**Frontend State Management:**
- Custom hooks (no Redux/Zustand)
- WebSocket events drive UI updates
- Local state for audio playback, recording status

## Testing

**Unit Tests:**
- `tests/` directory: 11 coverage map tests
- Focus on deterministic coverage logic, state transitions

**Integration Tests:**
- `smoke_test.py`: Verifies all LLM endpoints respond
- `stress_test.py`: 3 concurrent sessions to test WebSocket relay + agent orchestration

**Manual Testing:**
- Run full interview flow via `CandidateRoom.tsx`
- Monitor Band.ai dashboard for agent messages
- Verify audio files generated in `audio_output/`
- Check `events` table for complete audit trail

## Deployment

**Docker:**
- `docker-compose up --build`: Starts backend (port 8000) + frontend (port 80 via nginx)
- Persistent volumes: `db_data/` (SQLite), `audio_output/` (TTS files)

**Environment Variables:**
- `.env.example` contains all required keys
- `scripts/register_agents.py` auto-populates Band.ai agent tokens

## Additional Documentation

- **SYSTEM_DESIGN.md**: Full technical specification (880+ lines)
- **voicehire_dev plan.md**: 6-phase development execution plan
- **voicehire-uxui-redesign-brief.md**: UI/UX design specifications
- **README.md**: Quick start guide (<5 min setup)
