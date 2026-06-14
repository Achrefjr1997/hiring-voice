# VoiceHire — Technical Stack & Architecture

> Version: 1.0 — Based on actual codebase (June 2026)
> Band of Agents Hackathon 2026 — Competency Exploration Engine

---

## 1. Backend Tech Stack

| Concern | Technology | Source |
|---------|-----------|--------|
| Runtime | Python 3.x | `requirements.txt` |
| Web framework | FastAPI | `voicehire/api/server.py` — `from fastapi import FastAPI` |
| Server runner | uvicorn | `scripts/run_server.py` — `uvicorn.run()` |
| Async HTTP | httpx (AsyncClient + Client) | `voicehire/band/agent_base.py`, `voicehire/api/client.py` |
| AI API SDK | OpenAI Python SDK (`AsyncOpenAI`) | `voicehire/api/client.py` — `from openai import AsyncOpenAI` |
| WebSocket client | `websockets` library (for Band Phoenix Channels) | `voicehire/band/event_listener.py` — `import websockets` |
| Config loading | `python-dotenv` | `config.py` — `from dotenv import load_dotenv` |
| CORS | FastAPI CORSMiddleware | `voicehire/api/server.py` — origin: `http://localhost:5173` |
| Static file serving | FastAPI StaticFiles (mount at `/audio/`) | `voicehire/api/server.py` — `app.mount("/audio", ...)` |
| STT | Deepgram REST API via httpx | `voicehire/voice/stt.py` |
| TTS | Deepgram SSE streaming via httpx | `voicehire/voice/tts.py` |
| Auth header pattern | `X-API-Key` (Band platform standard) | `voicehire/band/agent_base.py` |

### Python Dependencies (from `requirements.txt`)
```
openai, pipecat-ai, langgraph, langchain, langchain-core,
pyautogen, instructor, httpx, python-dotenv, fastapi,
websockets, uvicorn
```

**Note:** `pipecat-ai`, `langgraph`, `langchain`, `langchain-core`, `pyautogen`, and `instructor` are listed but **not imported anywhere in the current codebase**. All agent logic uses direct httpx + OpenAI SDK calls.

---

## 2. Frontend Tech Stack

| Concern | Technology | Source |
|---------|-----------|--------|
| Framework | React 18 (functional + hooks only) | `package.json` — `"react": "^18.2.0"` |
| Language | TypeScript strict mode | `tsconfig.json` (strict) |
| Build tool | Vite 5 | `package.json` — `"vite": "^5.0.0"` |
| React plugin | `@vitejs/plugin-react` | `package.json` — devDependencies |
| Styling | Tailwind CSS v3.4 | `package.json` — `"tailwindcss": "^3.4.0"` |
| Tailwind vite plugin | `@tailwindcss/vite` | `vite.config.ts` |
| Icons | `lucide-react` | `package.json` — `"lucide-react": "^0.300.0"` |
| Charts | `recharts` (available, not used in current components) | `package.json` — `"recharts": "^2.10.0"` |
| Real-time transport | Native WebSocket API (browser) | `frontend/src/hooks/useBandSession.ts` — `new WebSocket(url)` |
| Audio capture | `MediaRecorder` API | `frontend/src/components/VoiceInterface.tsx` — `new MediaRecorder(stream)` |
| Audio playback | `HTMLAudioElement` | `frontend/src/components/VoiceInterface.tsx` — `new Audio(url)` |
| Build tooling | `postcss` + `autoprefixer` | `package.json` — devDependencies |
| State management | Custom `useBandSession` hook (no Redux/Zustand) | `frontend/src/hooks/useBandSession.ts` |

### Vite Dev Proxy (`vite.config.ts`)
```typescript
proxy: {
  '/session': 'http://localhost:8000',
  '/audio':   'http://localhost:8000',
  '/ws':      { target: 'ws://localhost:8000', ws: true },
}
```

### Frontend Component Tree
```
frontend/src/
├── main.tsx                          → ReactDOM entry
├── App.tsx                           → Root: SessionSetup | split-screen SessionView
├── types.ts                          → All TypeScript interfaces + state helpers
├── style.css                         → Tailwind directives
├── api/
│   └── bandApi.ts                    → sendAudioChunk() POST /session/{id}/audio
├── hooks/
│   ├── useBandSession.ts             → WebSocket connect, parse, state dispatch
│   └── useAudio.ts                   → MediaRecorder wrapper (start/stop/elapsed)
└── components/
    ├── SessionSetup.tsx              → JD/resume/rubric form
    ├── BandEventLog.tsx              → Live Band room feed with @sender labels
    ├── CoverageMapViz.tsx            → Real-time competency heatmap
    ├── VoiceInterface.tsx            → Mic button, transcript, TTS playback
    └── EvidencePortfolio.tsx         → Verdict, competency table, deliberation
```

---

## 3. External APIs & AI Providers

### 3.1 AI/ML API — `https://api.aimlapi.com/v1`

All chat completions use OpenAI-compatible `/v1/chat/completions` with `Authorization: Bearer`.

| Role | Model ID | Agent File | `response_format` | Temp | Max Tokens |
|------|----------|-----------|-------------------|------|------------|
| Rubric generation | `deepseek/deepseek-v4-pro` | `agents/rubric_synthesizer.py` | `json_object` | 0.1 | 4096 |
| Probe generation | `alibaba/qwen3-32b` | `agents/session_brain.py` | `json_object` | 0.7 | 512 |
| Technical evidence | `gpt-4o-mini` | `agents/evidence_chain.py` | `json_object` | 0.1 | 1024 |
| Coverage map update | `Qwen/Qwen2.5-72B-Instruct-Turbo` | (in MODELS dict, not actively used) | — | — | — |
| Committee deliberation | `Qwen/Qwen3-235B-A22B-fp8-tput` | `agents/hiring_committee.py` | `json_object` (chair only) | 0.4 | 2048 |

### 3.2 Featherless AI — `https://api.featherless.ai/v1`

Same `/v1/chat/completions` schema. Flat-rate unlimited tokens (hackathon promo `BOA26`).

| Role | Model ID | Agent File | `response_format` | Temp | Max Tokens |
|------|----------|-----------|-------------------|------|------------|
| Integrity skeptic | `deepseek-ai/DeepSeek-R1` | `agents/integrity_skeptic.py` | `json_object` | 0.3 | 1024 |
| Behavioral evidence | `mistralai/Mistral-7B-Instruct-v0.3` | `agents/evidence_chain.py` | `json_object` | 0.1 | 512 |

### 3.3 Deepgram — `https://api.deepgram.com`

| Role | Endpoint | Auth | Config Keys |
|------|----------|------|-------------|
| STT | `POST /v1/listen?model=nova-2&smart_format=true` | `Authorization: Token {key}` | `DEEPGRAM_KEY`, `DEEPGRAM_STT_MODEL = "nova-2"` |
| TTS probes | `POST /v1/speak?model=aura-2-apollo-en` (SSE streaming) | `Authorization: Token {key}` | `TTS_PROBE_MODEL = "aura-2-apollo-en"` |
| TTS fillers | `POST /v1/speak?model=aura-2-thalia-en` (SSE streaming) | `Authorization: Token {key}` | `TTS_FILLER_MODEL = "aura-2-thalia-en"` |

**STT:** Sends `audio/webm` bytes via `POST`, receives JSON with `results.channels[0].alternatives[0].transcript`. No async polling needed (unlike AI/ML API Whisper).

**TTS:** Sends text as `Content-Type: text/plain`, receives SSE audio stream (yields `bytes` chunks). Audio files saved to `audio_output/` and served via FastAPI `/audio/` static mount.

### 3.4 Band.ai Platform — `https://app.band.ai/api/v1`

**Authentication:** All endpoints use `X-API-Key` header (NOT Bearer). The typing error `BRANDAPIKEY` (missing `D`) in `config.py` is the actual env var name.

| Endpoint | Method | Token Used | Purpose |
|----------|--------|-----------|---------|
| `/me` | GET | `BRANDAPIKEY` | Resolve owner UUID, verify Band identity |
| `/me/agents` | GET | `BRANDAPIKEY` | List registered agents and their UUIDs |
| `/me/agents/register` | POST | `BRANDAPIKEY` | One-time: create agent, get `api_key` token |
| `/agent/chats` | POST | `BAND_TOKEN_SESSION_BRAIN` | Create a chat room per session |
| `/agent/chats/{id}/participants` | POST | `BAND_TOKEN_SESSION_BRAIN` | Add agent or human to room |
| `/agent/chats/{id}/participants` | GET | `BAND_TOKEN_SESSION_BRAIN` | List room participants |
| `/agent/chats/{id}/messages` | POST | Any `BAND_TOKEN_*` | Send directed message with `mentions` array |
| `/agent/chats/{id}/messages` | GET | Any `BAND_TOKEN_*` | Read room message history |
| `/agent/chats/{id}/events` | POST | Any `BAND_TOKEN_*` | Send broadcast event (no mentions) |
| `wss://app.band.ai/api/v1/socket/websocket?api_key=...&vsn=2.0.0` | WS | `BRANDAPIKEY` | Phoenix Channels real-time feed |

**6 Agent Tokens (from `.env`):**
```
BAND_TOKEN_SESSION_BRAIN
BAND_TOKEN_RUBRIC_SYNTHESIZER
BAND_TOKEN_VOICE_PERSONA
BAND_TOKEN_EVIDENCE_CHAIN
BAND_TOKEN_INTEGRITY_SKEPTIC
BAND_TOKEN_HIRING_COMMITTEE
```

### 3.5 Complete `.env` Requirements
```
AIMLAPI_KEY=<key>
FEATHERLESS_KEY=<key>
DEEPGRAM_KEY=<key>
BRANDAPIKEY=<key>                          # Band human API key (typo preserved: 'BRAND')
BAND_TOKEN_SESSION_BRAIN=<token>           # Populated by register_agents.py
BAND_TOKEN_RUBRIC_SYNTHESIZER=<token>      # Populated by register_agents.py
BAND_TOKEN_VOICE_PERSONA=<token>           # Populated by register_agents.py
BAND_TOKEN_EVIDENCE_CHAIN=<token>          # Populated by register_agents.py
BAND_TOKEN_INTEGRITY_SKEPTIC=<token>       # Populated by register_agents.py
BAND_TOKEN_HIRING_COMMITTEE=<token>        # Populated by register_agents.py
```

---

## 4. Architecture & Integration Patterns

### 4.1 Band Agent Base Class (`voicehire/band/agent_base.py`)

All 6 agents extend the abstract `BandAgent` class:

```
BandAgent (ABC)
├── __init__(handle, token_env_var)
│     → reads BAND_TOKEN_{HANDLE} from env
│     → creates httpx.AsyncClient with X-API-Key header
├── send_message(room_id, content, mention_ids?)
│     → POST /agent/chats/{room_id}/messages
│     → requires "mentions": [{"id": "<uuid>"}] for routing
├── send_to_agent(room_id, name, uuid, content)
│     → wraps send_message with single UUID mention
├── send_event(room_id, content, message_type="task")
│     → POST /agent/chats/{room_id}/events
│     → broadcast to all room participants (no mentions needed)
├── list_messages(room_id, limit=50)
│     → GET /agent/chats/{room_id}/messages
└── handle_mention(room_id, message)  [abstract]
      → called by event_listener when @mentioned
```

**Key protocol rule:** `send_to_agent()` requires the target agent's **UUID** (not handle string). Plain `@handle` text in content does NOT trigger Band's routing — the `mentions` array with UUID is mandatory.

### 4.2 Band Event Listener (`voicehire/band/event_listener.py`)

Runs as a persistent background `asyncio.Task` inside the FastAPI server's lifespan:

```
BandEventListener
├── start() → creates asyncio task for _listen_loop()
├── subscribe_to_rooms(room_ids)
│     → sends phx_join for each chat_room:{roomId}
│     → waits for phx_reply confirmations (5s timeout)
├── _listen_loop()
│     → while running:
│         wss://app.band.ai/...?api_key=...&vsn=2.0.0
│         → subscribes to all tracked rooms
│         → sends heartbeat every 25s (Phoenix requirement)
│         → recv with 30s timeout, reconnects after 3s
├── _handle_message(raw)
│     → parses Phoenix Channels array: [joinRef, ref, topic, event, payload]
│     → "phx_reply" → confirm subscription
│     → "message_created" → route by mentions UUID -> AgentRegistry
│     → "event_created" → route by content prefix -> EVENT_ROUTES dict
└── relay_fn callback → forwards events to frontend WS connections

AgentRegistry
├── register(handle, uuid, instance)
├── get_by_handle(handle)
├── get_by_uuid(uuid)
└── route_event(content) → list of (handle, agent) matched by prefix

EVENT_ROUTES = {
    "COMPETENCY_GRAPH_READY": "session-brain",
    "EVIDENCE": "session-brain",
    "CHALLENGE": "session-brain",
    # Other events have None routing → broadcast only
}
```

### 4.3 Band Session Factory (`voicehire/band/session_factory.py`)

Creates 3 Band Chat Rooms per session using the **Agent API** (not Human API, which requires Enterprise plan):

```
BandSessionFactory
├── _load_agent_ids()
│     → GET /me/agents → caches {name: {id, handle}}
│     → Called once, cached for all subsequent sessions
├── create_session(session_id)
│     → GET /me → resolve owner UUID
│     → POST /agent/chats → create "voicehire-{id}-foundation"
│     → POST /agent/chats → create "voicehire-{id}-exploration"
│     → POST /agent/chats → create "voicehire-{id}-committee"
│     → POST /agent/chats/{id}/participants (owner UUID) → all 3 rooms
│     → POST /agent/chats/{id}/participants (agent UUIDs) → per room
│     → return BandSession with all 3 room IDs
└── get_agent_id(name) → str | None

Room → Agent mapping:
──────────────
Foundation  → Rubric Synthesizer
Exploration → Voice Persona, Evidence Chain, Integrity Skeptic
Committee   → Hiring Committee
```

The `@session-brain` is **not added as a participant** via factory — it creates the rooms using its own token and participates implicitly as the room creator.

### 4.4 FastAPI WebSocket Relay (`voicehire/api/server.py`)

The frontend does NOT connect to Band directly. Instead:

```
Band Platform (Phoenix Channels WS)
    │ event_created / message_created
    ▼
event_listener.py (_listen_loop)
    │ processes → calls relay_fn()
    ▼
_relay_to_frontend(room_id, event_type, payload)
    │ looks up session_id from room_to_session dict
    │ finds all WebSocket clients for that session_id
    ▼
JSON: { "event": "event_created", "topic": "chat_room:{room_id}", ...payload }
    │
    ▼
ws://localhost:8000/ws/{session_id}
    │
    ▼
Browser useBandSession hook (onmessage handler)
```

### 4.5 CamelCase → snake_case Pipeline (`voicehire/util.py`)

The `normalize_keys()` function recursively converts camelCase dictionary keys to snake_case:

```python
def normalize_keys(d: dict) -> dict:
    new = {}
    for k, v in d.items():
        sk = _camel_to_snake(k)
        if isinstance(v, dict):
            new[sk] = normalize_keys(v)
        elif isinstance(v, list):
            new[sk] = [normalize_keys(i) if isinstance(i, dict) else i for i in v]
        else:
            new[sk] = v
    return new
```

**Used by:** `rubric_synthesizer.py`, `evidence_chain.py`, `integrity_skeptic.py`, `hiring_committee.py`

### 4.6 Agent UUID Resolution Pattern

```python
# server.py (lifespan context)
voice_id = factory.get_agent_id("Voice Persona")
chain_id = factory.get_agent_id("Evidence Chain")
committee_id = factory.get_agent_id("Hiring Committee")
brain_id = factory.get_agent_id("Session Brain")
rubric_id = factory.get_agent_id("Rubric Synthesizer")
skeptic_id = factory.get_agent_id("Integrity Skeptic")

# Passed to constructors:
brain = SessionBrain(voice_id=voice_id, chain_id=chain_id, committee_id=committee_id)
rubric = RubricSynthesizer(brain_id=brain_id)
voice = VoicePersona(brain_id=brain_id)
chain = EvidenceChain(brain_id=brain_id, skeptic_id=skeptic_id)
skeptic = IntegritySkeptic(brain_id=brain_id)
committee = HiringCommittee(brain_id=brain_id)

# Registered in AgentRegistry:
registry.register("session-brain", brain_id, brain)
registry.register("rubric-synthesizer", rubric_id, rubric)
# ... etc for all 6 agents
```

### 4.7 Audio Proxy Architecture

```
Browser MediaRecorder → blob (audio/webm;codecs=opus)
    │ POST /session/{session_id}/audio (multipart FormData)
    ▼
FastAPI server.py
    │ 1. Returns pre-generated filler URL from audio_output/
    │ 2. Creates asyncio.create_task for background STT
    ▼
_process_audio_background(audio_bytes, exploration_room_id, brain_id):
    ├── Deepgram STT (nova-2): POST /v1/listen
    ├── Posts CANDIDATE_UTTERANCE: <transcript> event to Exploration room
    └── Posts @session-brain UTTERANCE: <transcript> directed message
```

### 4.8 Key Scripts

| Script | Purpose | Run When |
|--------|---------|----------|
| `scripts/register_agents.py` | One-time: creates 6 Band.ai agents, saves tokens to `.env` | First setup |
| `scripts/check_agents.py` | Lists registered agents + UUIDs | Setup verification |
| `scripts/run_server.py` | Starts uvicorn on `127.0.0.1:8000` (stdout → `server_debug.log`) | Every session |
| `scripts/smoke_test.py` | Tests 7 chat model endpoints (`max_tokens=5`) | Phase 0 verification |
| `scripts/stress_test.py` | 3-session stress test (Backend/ML/Manager JDs) + timing | Phase 5 |
| `scripts/test_session.py` | Quick session create + timing | Development |
| `scripts/test_factory.py` | Verify BandSessionFactory creates 3 rooms | Development |
| `scripts/test_messaging.py` | Full Band API flow: room creation, events, messages, WS subscription | Development |
| `scripts/test_ws.py` | Band WebSocket connectivity test | Development |
| `scripts/verify_events.py` | Listen for events on specific room IDs | Development |

### 4.9 Tests (`tests/test_coverage_map.py`)

6 pytest tests for `CoverageMap`:

| Test | Scenario | Expected |
|------|----------|----------|
| `test_all_unexplored` | 3 MUST_HAVEs with weights 0.5, 0.3, 0.2 | Returns highest weight (0.5) |
| `test_one_weak_rest_unexplored` | 1 WEAK + 1 UNEXPLORED MUST_HAVE | UNEXPLORED wins (1.5x multiplier) |
| `test_all_covered` | Both MUST_HAVEs COVERED | Returns None |
| `test_must_have_beats_nice_to_have` | UNEXPLORED MUST_HAVE vs NICE_TO_HAVE | MUST_HAVE selected |
| `test_empty_competencies` | No competencies | Returns None |
| `test_apply_evidence_snake_case` | Evidence with snake_case keys | Status transitions correctly |

---

## 5. Core Project Mechanics (End-to-End Flow)

### 5.0 One-Time Setup

1. **Create Band.ai account** at `app.band.ai`, generate API key → set `BRANDAPIKEY` in `.env`
2. **Install dependencies**: `pip install -r requirements.txt` + `cd frontend && npm install`
3. **Register agents**: `python scripts/register_agents.py` — creates 6 agents on Band, appends `BAND_TOKEN_*` to `.env`
4. **Verify**: `python scripts/smoke_test.py` — tests 7 chat model endpoints
5. **Start server**: `python scripts/run_server.py` (uvicorn on `:8000`)
6. **Start frontend**: `cd frontend && npm run dev` (Vite on `:5173`)

### 5.1 Session Creation

```
Browser (SessionSetup.tsx)
  │ POST /session/create (jd, resume, rubric, role_level)
  ▼
FastAPI (server.py:create_session)
  ├── BandSessionFactory.create_session(session_id)
  │     ├── GET /me → owner UUID
  │     ├── POST /agent/chats → "voicehire-{id}-foundation"
  │     ├── POST /agent/chats → "voicehire-{id}-exploration"
  │     ├── POST /agent/chats → "voicehire-{id}-committee"
  │     ├── POST /participants (owner UUID) → all 3 rooms
  │     └── POST /participants (Rubric/Voice/Chain/Skeptic/Committee UUIDs) → per room
  │
  ├── event_listener.subscribe_to_rooms([all 3 room IDs])
  ├── POST /agent/chats/{foundation}/messages
  │     content: "@Rubric Synthesizer JD: ... | RESUME: ... | RUBRIC: ... | LEVEL: ..."
  │     mentions: [{id: <rubric-uuid>}]
  │
  └── Returns: { session_id, foundation_room_id, exploration_room_id, committee_room_id }

Browser (useBandSession.ts)
  └── connect(session_id) → WebSocket ws://localhost:8000/ws/{session_id}
```

### 5.2 Foundation Phase (T+0s → T+90s)

```
1. @rubric-synthesizer.handle_mention(room_id, message)
     ├── Extracts JD, RESUME, RUBRIC, LEVEL from message content
     ├── Calls DeepSeek V4 Pro (3-attempt retry, response_format: json_object)
     ├── Validates: competencies list, weights sum ~1.0, valid classifications
     ├── Normalizes camelCase→snake_case via util.normalize_keys()
     ├── send_event("COMPETENCY_GRAPH_READY: <json>")  → broadcast
     └── send_to_agent("Session Brain", brain_uuid, "COMPETENCY_GRAPH_READY: <json>")

2. @session-brain.handle_mention(room_id, message)
     ├── Idempotency guard: if coverage_map exists, return
     ├── CoverageMap(competencies, skill_implications) → all UNEXPLORED
     ├── send_event("COVERAGE_MAP_INIT: <summary>")  → broadcast
     └── _generate_next_probe(room_id)
           ├── CoverageMap.select_next_target()
           ├── Calls Qwen3 32B: probe system prompt + target context + conversation history
           ├── send_to_agent("Voice Persona", voice_uuid, "SPEAK: <probeText>")
           └── send_event("PROBE_GENERATED: <json>")
```

### 5.3 Exploration Loop (T+42s → SESSION_END)

```
CANDIDATE SPEAKS
  Browser: MediaRecorder captures audio → blob (audio/webm;codecs=opus)
    │ POST /session/{session_id}/audio (FormData)
    ▼
FastAPI:
  ├── Returns { filler_url } → browser plays pre-generated filler TTS
  └── Background task:
        ├── Deepgram STT: POST /v1/listen?model=nova-2 → returns transcript
        ├── send_event("CANDIDATE_UTTERANCE: <transcript>")
        └── send_to_agent("Session Brain", brain_uuid, "UTTERANCE: <transcript>")

@session-brain.handle_mention("UTTERANCE:")
  ├── Appends to conversation_history
  └── send_to_agent("Evidence Chain", chain_uuid,
        "EXTRACT: UTTERANCE: <transcript> PROBE: <current_target>")

@evidence-chain.handle_mention("EXTRACT:")
  ├── Parallel extraction via asyncio.gather:
  │     ├── Tech: AI/ML API gpt-4o-mini (response_format: json_object)
  │     └── Behavioral: Featherless Mistral 7B (response_format: json_object)
  ├── Merge into EvidenceNode
  ├── send_to_agent("Session Brain", brain_uuid, "EVIDENCE: <json>")
  └── send_to_agent("Integrity Skeptic", skeptic_uuid, "EVALUATE: <json>")

@session-brain.handle_mention("EVIDENCE:")
  ├── Appends to evidence_portfolio
  ├── CoverageMap.apply_evidence(evidence_node) → returns delta
  ├── send_event("COVERAGE_MAP_UPDATE: <delta>")
  └── _generate_next_probe(room_id) → repeats probe cycle

@integrity-skeptic.handle_mention("EVALUATE:")
  ├── Filter: tags where confidence ≥ 0.80 AND polarity == "POSITIVE"
  ├── If none: return (fast exit, no API call)
  ├── Call DeepSeek R1 on Featherless
  └── If shouldChallenge:
        ├── send_to_agent("Session Brain", brain_uuid,
        │     "CHALLENGE: <reason> ADJUSTED_CONFIDENCE: <adjustments>")
        └── send_message(room_id, visible challenge with R1 thinking trace)

@session-brain.handle_mention("CHALLENGE:")
  ├── CoverageMap.apply_confidence_adjustment(adjustments)
  └── send_event("COVERAGE_MAP_UPDATE: <delta_with_skeptic_adjusted>")
```

### 5.4 Session End

```
Recruiter clicks "End session"
  │ POST /session/{session_id}/end
  ▼
FastAPI:
  ├── POST /agent/chats/{exploration_room}/messages
  │     content: "@session-brain SESSION_END"
  └── status = "ENDED"

@session-brain.handle_mention("SESSION_END")
  ├── CoverageMap.summary() → { covered, must_have_total, must_have_covered, ... }
  ├── Portfolio: { nodes: evidence_portfolio, coverageSummary: summary }
  └── send_to_agent("Hiring Committee", committee_uuid,
        "SESSION_END: PORTFOLIO: <portfolio_json>")

@hiring-committee.handle_mention("SESSION_END:")
  └── _deliberate(room_id, portfolio)
        ├── Round 1: Technical Advocate
        ├── Round 2: Evidence Critic
        ├── Round 3: Committee Chair (response_format: json_object)
        ├── normalize_keys(chair_response)
        ├── Add: deliberation_transcript, model_used
        ├── send_message("COMMITTEE_DECISION: <decision_json>")
        └── send_message("REPORT_READY")
```

### 5.5 Frontend Rendering

```
Band WebSocket → FastAPI relay → Browser useBandSession.ts

Event → State Update → Component Re-render:
─────────────────────────────────────────
COMPETENCY_GRAPH_READY → initCoverageMap()   → CoverageMapViz (seeded)
COVERAGE_MAP_UPDATE   → applyCoverageUpdate() → CoverageMapViz (updated)
PROBE_GENERATED       → events[]              → BandEventLog (@session-brain row)
SPEAK                 → events[]              → VoiceInterface (plays audio + bubble)
CANDIDATE_UTTERANCE   → events[]              → VoiceInterface (candidate bubble)
INTEGRITY_CHALLENGE   → events[]              → BandEventLog (@integrity-skeptic, expandable)
COMMITTEE_DECISION    → decision state         → EvidencePortfolio (verdict + table + transcript)
```

---

## 6. Notable Implementation Details

### 6.1 Config Typo
`config.py:` reads `os.environ["BRANDAPIKEY"]` (missing letter `D` — "BRAND" not "BAND"). The variable `BAND_API_KEY` in code maps to this misspelled env var.

### 6.2 Pre-generated Filler TTS
`voice_persona.py` generates filler audio files at server startup (`prefetch_fillers()` → `asyncio.gather` of 5 Deepgram TTS calls). Files stored in `audio_output/filler_{0-4}.mp3`. FastAPI returns pre-generated filler URL immediately on audio POST — no TTS latency for fillers.

### 6.3 Probe ID Generation
`session_brain.py` generates `probeId` via `uuid.uuid4().hex[:8]` — important for evidence→probe traceability.

### 6.4 Idempotency Guard
`session_brain.py:_on_graph_ready()` has `if self.coverage_map is not None: return` — prevents double processing when both the broadcast event AND the directed @mention deliver the same `COMPETENCY_GRAPH_READY`.

### 6.5 Cross-Room Evidence Forwarding
`session_brain.py:_on_evidence()` forwards evidence nodes to the Committee room via `send_to_agent(committee_room_id, "Hiring Committee", ...)` — lets `@hiring-committee` accumulate evidence in parallel during the interview.

### 6.6 Not Yet Implemented
- `reports/report_generator.py` — HTML report generation (planned for Phase 5)
- `voicehire/competency/probe_generator.py` — probe generation is inline in `session_brain.py`
- Direct Band WebSocket connection from frontend (currently proxied through FastAPI)

---

*VoiceHire — Technical Stack & Architecture*
*Band of Agents Hackathon 2026 · AI/ML API + Featherless AI + Deepgram + Band.ai*
*Document generated from actual codebase audit — every fact verified against source files*
