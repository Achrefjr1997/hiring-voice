# VoiceHire v4 — Developer Execution Plan
## Competency Exploration Engine · Band of Agents Hackathon 2026

**Document type:** Technical Development Plan  
**Version:** 1.0  
**Date:** June 13, 2026  
**Based on:** VoiceHire v4 Final Architecture Specification  
**Prepared by:** Tech Lead

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Repository Structure](#3-repository-structure)
4. [Development Phases](#4-development-phases)
   - [Phase 0 — Environment Bootstrap](#phase-0--environment-bootstrap-day-1-morning)
   - [Phase 1 — Core Infrastructure](#phase-1--core-infrastructure-day-1)
   - [Phase 2 — Foundation Room](#phase-2--foundation-room-day-2)
   - [Phase 3 — Exploration Room](#phase-3--exploration-room-day-3)
   - [Phase 4 — Integrity & Committee](#phase-4--integrity--committee-room-day-4)
   - [Phase 5 — Integration & Polish](#phase-5--integration--polish-day-5)
   - [Phase 6 — Submission](#phase-6--submission-day-6)
5. [Intermediate Test Suite](#5-intermediate-test-suite)
6. [Acceptance Criteria](#6-acceptance-criteria)
7. [Risk Register](#7-risk-register)
8. [Progress Tracker](#8-progress-tracker)

---

## 1. Project Overview

VoiceHire v4 is a **real-time AI-powered interviewing system** built on a multi-agent architecture. The system uses a band of six specialized agents across three logical rooms to conduct competency-driven interviews without any predefined question banks or YAML files.

### Core Mandate
> No static question banks. No YAML files. No predefined questions.  
> Every probe is generated from what was just said.  
> Every hiring decision is built from evidence, not scores.

### Agents Summary

| # | Agent | Framework | Primary Model | Provider |
|---|-------|-----------|--------------|----------|
| 1 | Session Brain | LangGraph | Qwen3 32B | AI/ML API |
| 2 | Rubric Synthesizer | Instructor | DeepSeek V4 Pro | AI/ML API |
| 3 | Voice Persona | Pipecat | Whisper Large + ElevenLabs | AI/ML API |
| 4 | Evidence Chain | LangChain LCEL | Llama 4 Scout + Mistral 7B | AI/ML API + Featherless |
| 5 | Integrity Skeptic | AutoGen | DeepSeek R1 | Featherless |
| 6 | Hiring Committee | AutoGen GroupChat | Qwen3 235B A22B | AI/ML API |

### Budget Constraint
- AI/ML API: $10 hackathon credit (~90 full sessions at $0.11/session)
- Featherless AI: $25 hackathon credit (promo: `BOA26`)

---

## 2. Tech Stack & Dependencies

### Python Backend

```bash
pip install openai pipecat-ai langgraph langchain langchain-core \
            pyautogen instructor httpx python-dotenv fastapi \
            websockets uvicorn
```

### Node Frontend

```bash
npm install react react-dom typescript @types/react \
            lucide-react recharts tailwindcss
```

### Environment Variables

```bash
# .env (never commit)
AIMLAPI_KEY=<your_aimlapi_key>
FEATHERLESS_KEY=<your_featherless_key>
```

### API Endpoints Reference

| Purpose | Method | URL |
|---------|--------|-----|
| Chat completions (AI/ML) | POST | `https://api.aimlapi.com/v1/chat/completions` |
| STT | POST | `https://api.aimlapi.com/v1/stt/create` |
| TTS | POST | `https://api.aimlapi.com/v1/tts` |
| Chat completions (Featherless) | POST | `https://api.featherless.ai/v1/chat/completions` |

---

## 3. Repository Structure

```
voicehire/
├── agents/
│   ├── rubric_synthesizer.py     ← Agent 2: DeepSeek V4 Pro
│   ├── session_brain.py          ← Agent 1: LangGraph state machine
│   ├── voice_persona.py          ← Agent 3: Pipecat + Whisper + ElevenLabs
│   ├── evidence_chain.py         ← Agent 4: LCEL parallel chains
│   ├── integrity_skeptic.py      ← Agent 5: DeepSeek R1 on Featherless
│   └── hiring_committee.py       ← Agent 6: AutoGen + Qwen3 235B
├── competency/
│   ├── coverage_map.py           ← Pure Python deterministic tracker
│   ├── graph_models.py           ← Dataclasses (CompetencyGraph, EvidenceNode...)
│   └── probe_generator.py        ← Qwen3 32B probe generation
├── band/
│   ├── room_factory.py           ← 3-room Band creation
│   ├── event_publisher.py
│   ├── event_subscriber.py
│   └── schemas/events.py         ← TypeScript event schema
├── api/
│   └── client.py                 ← Unified AIML + Featherless clients + MODELS dict
├── voice/
│   ├── stt.py                    ← Whisper Large polling wrapper
│   └── tts.py                    ← ElevenLabs + TTS-1 wrapper
├── reports/
│   └── report_generator.py       ← Evidence portfolio → HTML report
├── frontend/src/
│   ├── components/
│   │   ├── VoiceInterface.tsx
│   │   ├── CoverageMapViz.tsx    ← Real-time heatmap
│   │   ├── BandEventLog.tsx      ← Live event stream + model labels
│   │   └── EvidencePortfolio.tsx
│   └── App.tsx
├── config.py
├── .env
└── requirements.txt

# ABSENT BY DESIGN:
# questions/        ← DOES NOT EXIST
# question_bank/    ← DOES NOT EXIST
# *.yaml            ← DOES NOT EXIST
```

---

## 4. Development Phases

---

### Phase 0 — Environment Bootstrap (Day 1, Morning)

**Goal:** Zero dead time when we start coding. All keys work. All installs complete.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 0.1 | Create repo, `.env`, `config.py` | Lead | `config.py`, `.env` |
| 0.2 | Install all Python dependencies | Lead | `requirements.txt` |
| 0.3 | Install all Node dependencies | Frontend | `package.json` |
| 0.4 | Activate Featherless promo code `BOA26` | Lead | — |
| 0.5 | Write `scripts/smoke_test.py` — one call to each of the 10 model endpoints | Lead | `scripts/smoke_test.py` |
| 0.6 | Run smoke test; confirm all 10 endpoints respond | Lead | — |

#### Smoke Test Script Spec

`scripts/smoke_test.py` must:
- Import `AIMLAPIClient` and `FeatherlessClient` from `api/client.py`
- Call `chat.completions.create` with `max_tokens=5` for each model in `MODELS` dict
- Call STT with a 1-second silence WAV
- Call TTS with "Hello" using both TTS models
- Print `[OK]` or `[FAIL]` for each model, with latency in ms

#### Phase 0 Exit Gate

```
✅ All 10 model endpoints return [OK]
✅ STT endpoint returns a response (even empty transcript)
✅ Both TTS endpoints return an audio URL
✅ .env is gitignored and not committed
```

---

### Phase 1 — Core Infrastructure (Day 1, Afternoon)

**Goal:** Band event system live. Voice round-trip working end-to-end. React dev server running.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 1.1 | Implement `Band` class: 3 rooms, `publish()`, `subscribe()`, `wait_for()` | Lead | `band/room_factory.py`, `event_publisher.py`, `event_subscriber.py` |
| 1.2 | Define all event types from spec Part V | Lead | `band/schemas/events.py` |
| 1.3 | Implement `VoicePersona` skeleton: VAD stub → STT → filler TTS → hardcoded probe TTS | Backend | `agents/voice_persona.py`, `voice/stt.py`, `voice/tts.py` |
| 1.4 | Wire `VoicePersona` to Band: publishes `CANDIDATE_UTTERANCE`, `SPEAK` | Backend | `agents/voice_persona.py` |
| 1.5 | Build React dev server: `App.tsx` + `BandEventLog.tsx` consuming Band events over WebSocket | Frontend | `frontend/src/` |
| 1.6 | FastAPI WebSocket bridge: Band events → browser | Backend | `api/websocket.py` |
| 1.7 | End-to-end voice test: speak into browser → transcribed in console → TTS plays back | All | — |

#### Latency Budget for Voice Round-Trip

```
Utterance end detected    T+0ms
Filler fires              T+200ms  (OpenAI TTS-1, target: <250ms)
Whisper transcript ready  T+600ms
Probe TTS ready           T+1400ms (target: during filler window)
Dead air perceived        < 500ms
```

If filler latency exceeds 500ms: investigate TTS-1 endpoint, switch test to shorter phrase.

#### Phase 1 Exit Gate

```
✅ Band: publish() and subscribe() work across 3 rooms
✅ BandEventLog renders events in real time in browser
✅ Human speaks into browser → Whisper transcribes → ElevenLabs speaks response
✅ Filler fires within 500ms of utterance end
✅ Dead air < 1 second perceived from user perspective
```

---

### Phase 2 — Foundation Room (Day 2)

**Goal:** Real JD → CompetencyGraph JSON → first probe text. Session Brain LangGraph state machine live.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 2.1 | Implement data models: `CompetencyNode`, `CompetencyGraph`, `EvidenceThreshold` | Lead | `competency/graph_models.py` |
| 2.2 | Implement `RubricSynthesizer`: system prompt, user content construction, 3-attempt retry loop, JSON schema validation | Backend | `agents/rubric_synthesizer.py` |
| 2.3 | Implement `CoverageMap`: `CompetencyState` dataclass, `apply_evidence()`, `select_next_target()`, `get_snapshot()` | Backend | `competency/coverage_map.py` |
| 2.4 | Write 5 unit tests for `select_next_target()` edge cases | Backend | `tests/test_coverage_map.py` |
| 2.5 | Implement `ProbeGenerator`: context assembly, Qwen3 32B call, probe JSON validation | Backend | `competency/probe_generator.py` |
| 2.6 | Implement `SessionBrain` LangGraph: 4-node graph (INIT → RUBRIC → PROBE_CYCLE → END), state schema | Backend | `agents/session_brain.py` |
| 2.7 | Wire Foundation Room: `SESSION_INIT` → `RubricSynthesizer` → `COMPETENCY_GRAPH_READY` → `CoverageMap` init → `COVERAGE_MAP_INIT` → `PROBE_GENERATED` | Backend | `agents/session_brain.py` |
| 2.8 | Terminal demo: paste real JD → CompetencyGraph printed → first probe text printed | All | `scripts/demo_rubric.py` |

#### `select_next_target()` Test Cases

```python
# tests/test_coverage_map.py
# TC-01: All UNEXPLORED → picks highest weight MUST_HAVE
# TC-02: One WEAK, rest UNEXPLORED → picks WEAK (boost incomplete first)
# TC-03: All COVERED → returns None (session should end)
# TC-04: Mix of MUST_HAVE and NICE_TO_HAVE UNEXPLORED → MUST_HAVE selected
# TC-05: MUST_HAVE all COVERED, NICE_TO_HAVE UNEXPLORED → NICE_TO_HAVE selected
```

#### CompetencyGraph Validation Rules

After `RubricSynthesizer` returns JSON, assert:
- `competencies` is a non-empty list
- Each competency has: `competency_id`, `name`, `domain`, `classification`, `depth_required`, `weight`
- All `classification` values are `MUST_HAVE` or `NICE_TO_HAVE`
- All `weight` values sum to ~1.0 (±0.05 tolerance)
- `skillImplications` is a dict (may be empty)
- `domainWeights` is a dict with float values

#### Phase 2 Exit Gate

```
✅ Real JD text → CompetencyGraph JSON produced in < 30 seconds
✅ CompetencyGraph passes all 6 validation assertions
✅ CoverageMap initialized: all competencies UNEXPLORED
✅ select_next_target() passes all 5 unit tests
✅ ProbeGenerator returns valid probe JSON anchored to a CompetencyState
✅ SessionBrain LangGraph transitions: INIT → RUBRIC → PROBE_CYCLE without error
✅ Band events published: COMPETENCY_GRAPH_READY, COVERAGE_MAP_INIT, PROBE_GENERATED
```

---

### Phase 3 — Exploration Room (Day 3)

**Goal:** 5-minute mock session where coverage map visibly updates after each candidate answer.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 3.1 | Implement `EvidenceChain`: parallel `asyncio.gather` for tech (Llama 4 Scout) + behavioral (Mistral 7B) | Backend | `agents/evidence_chain.py` |
| 3.2 | Implement EvidenceNode merge logic: combine `competencyTags`, `behavioralTags`, `extractedSignals`, `ownershipScore` | Backend | `agents/evidence_chain.py` |
| 3.3 | Wire `CANDIDATE_UTTERANCE` → `EvidenceChain.extract()` → `EVIDENCE_EXTRACTED` Band event | Backend | `agents/session_brain.py` |
| 3.4 | Wire `EVIDENCE_EXTRACTED` → `CoverageMap.apply_evidence()` → `COVERAGE_MAP_UPDATE` Band event | Backend | `competency/coverage_map.py` |
| 3.5 | Wire `COVERAGE_MAP_UPDATE` → `SessionBrain.select_next_target()` → `ProbeGenerator` → `PROBE_GENERATED` | Backend | `agents/session_brain.py` |
| 3.6 | Build `CoverageMapViz.tsx`: real-time competency heatmap, color-coded UNEXPLORED/WEAK/COVERED | Frontend | `frontend/src/components/CoverageMapViz.tsx` |
| 3.7 | Wire `BandEventLog` to show model name on each event | Frontend | `frontend/src/components/BandEventLog.tsx` |
| 3.8 | Filler cancellation: confirm filler task is cancelled when probe is ready, < 0.5s gap | Backend | `agents/voice_persona.py` |
| 3.9 | 5-minute mock session with scripted answers: verify coverage map updates | All | — |

#### Evidence Chain Latency Targets

| Step | Target | Hard Limit |
|------|--------|------------|
| STT (Whisper Large) | 600ms | 1500ms |
| Tech extraction (Llama 4 Scout) | 1400ms | 2500ms |
| Behavioral extraction (Mistral 7B) | 900ms | 2000ms |
| Evidence merge (Python) | 5ms | 50ms |
| Coverage map update (Python) | 5ms | 50ms |
| Probe generation (Qwen3 32B) | 1800ms | 3500ms |
| **Total pipeline (parallel)** | **~2.5s** | **4s** |

#### EvidenceNode Completeness Check

After each `EVIDENCE_EXTRACTED` event, assert:
- `evidenceId` is non-null and unique
- `rawTranscript` matches the utterance that was published
- `competenciesTagged` is a list (may be empty for off-topic answers)
- Each tag has `competencyId`, `confidence` (0.0–1.0), `polarity` in `[POSITIVE, NEUTRAL, NEGATIVE]`
- `overallConfidence` is computed correctly

#### Phase 3 Exit Gate

```
✅ EvidenceChain runs both chains in true parallel (asyncio.gather confirmed)
✅ Tech extraction latency < 2.5s for 200-word utterance
✅ Behavioral extraction latency < 2.0s for 200-word utterance
✅ CoverageMapViz renders and updates in real time after each answer
✅ At least one competency transitions UNEXPLORED → WEAK in the mock session
✅ Filler system: dead air < 500ms perceived in the mock session
✅ BandEventLog shows model names on PROBE_GENERATED and EVIDENCE_EXTRACTED events
✅ 5-minute mock session completes without error or crash
```

---

### Phase 4 — Integrity & Committee Room (Day 4)

**Goal:** Full session start-to-finish produces a real `HiringDecision` JSON. Skeptic challenges are visible in the Band log.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 4.1 | Implement `IntegritySkeptic`: filter high-confidence tags (>= 0.80), call DeepSeek R1 on Featherless, capture `<think>` trace | Backend | `agents/integrity_skeptic.py` |
| 4.2 | Wire `EVIDENCE_EXTRACTED` → `IntegritySkeptic.evaluate()` (async, non-blocking to voice pipeline) | Backend | `agents/session_brain.py` |
| 4.3 | Wire Skeptic output: `INTEGRITY_CHALLENGE` + `CONFIDENCE_ADJUSTMENT` Band events | Backend | `agents/integrity_skeptic.py` |
| 4.4 | Apply `CONFIDENCE_ADJUSTMENT` to `CoverageMap`: update confidence scores | Backend | `competency/coverage_map.py` |
| 4.5 | Implement `HiringCommittee`: 3-round AutoGen deliberation (Advocate → Critic → Chair), `HiringDecision` JSON output | Backend | `agents/hiring_committee.py` |
| 4.6 | Wire `SESSION_END` → `HiringCommittee.deliberate()` → `COMMITTEE_DECISION` Band event | Backend | `agents/session_brain.py` |
| 4.7 | Implement `ReportGenerator`: evidence portfolio → HTML report with decision, verdicts, evidence IDs | Backend | `reports/report_generator.py` |
| 4.8 | Wire `COMMITTEE_DECISION` → `ReportGenerator` → `REPORT_READY` | Backend | `reports/report_generator.py` |
| 4.9 | Full mock session end-to-end: start → interview → SESSION_END → Decision → Report | All | — |

#### Skeptic Trigger Logic

```python
# Trigger condition (as implemented):
high_confidence_tags = [
    t for t in evidence_node["competenciesTagged"]
    if t["confidence"] >= 0.80 and t["polarity"] == "POSITIVE"
]
# If empty → return None (no challenge, fast exit)
# If non-empty → call DeepSeek R1
```

The Skeptic must NOT block the probe generation pipeline. Run it as a background `asyncio.create_task`.

#### HiringDecision Schema Validation

After `COMMITTEE_DECISION` is published, assert:
- `verdict` is one of `HIRE`, `NO_HIRE`, `STRONG_HIRE`, `HOLD`
- `competencyVerdicts` is a list with at least one entry per MUST_HAVE competency
- Each verdict entry cites at least one `evidenceId`
- `deliberationTranscript.advocate` and `deliberationTranscript.critic` are non-empty strings
- `model` equals `"Qwen/Qwen3-235B-A22B-fp8-tput"`
- No competency verdict says "score" anywhere — decisions must be evidence-based

#### Session Lifecycle State Machine

```
SESSION_INIT
    ↓
RUBRIC_GENERATION (T+5s)
    ↓
COMPETENCY_GRAPH_READY (T+20s)
    ↓
COVERAGE_MAP_INIT (T+22s)
    ↓
SESSION_READY (T+42s)
    ↓
[PROBE_CYCLE repeats until]
    → All MUST_HAVEs COVERED, or
    → Session time limit reached, or
    → EARLY_COMPLETION triggered
    ↓
SESSION_END
    ↓
COMMITTEE_SESSION_START
    ↓
COMMITTEE_DECISION
    ↓
REPORT_READY
```

#### Phase 4 Exit Gate

```
✅ IntegritySkeptic fires INTEGRITY_CHALLENGE when confidence >= 0.80 on a vague answer
✅ DeepSeek R1 thinking trace appears in BandEventLog (visible <think> content)
✅ CONFIDENCE_ADJUSTMENT correctly lowers coverage map confidence
✅ Skeptic runs as background task — does NOT delay next probe
✅ HiringCommittee produces valid HiringDecision JSON
✅ HiringDecision passes all 6 schema validation assertions
✅ ReportGenerator produces readable HTML with all evidence IDs
✅ Full session (start → decision → report) completes without crash
✅ SESSION_END → REPORT_READY total time < 120 seconds
```

---

### Phase 5 — Integration & Polish (Day 5)

**Goal:** 3 clean end-to-end sessions with different JDs. Demo script rehearsed. No crashes.

#### Steps

| # | Task | Owner | File(s) |
|---|------|-------|---------|
| 5.1 | Run Session 1: Senior Backend Engineer JD. Fix all crashes. | All | — |
| 5.2 | Run Session 2: Staff ML Engineer JD. Fix all crashes. | All | — |
| 5.3 | Run Session 3: Engineering Manager JD. Fix all crashes. | All | — |
| 5.4 | Polish `CoverageMapViz`: status color transitions must be smooth, impressive | Frontend | `frontend/src/components/CoverageMapViz.tsx` |
| 5.5 | Polish `BandEventLog`: every event shows model name + provider + latency | Frontend | `frontend/src/components/BandEventLog.tsx` |
| 5.6 | Implement `Codeband` agent (if credits permit): trigger on `CODE_CHALLENGE_INITIATED`, Llama 4 Scout code analysis | Backend | `agents/codeband.py` |
| 5.7 | Write `scripts/demo_script.md`: 6-minute script, every moment timed and scripted | Lead | `scripts/demo_script.md` |
| 5.8 | Rehearse demo script once end-to-end | All | — |
| 5.9 | Verify no YAML files, no `questions/` directory exists | All | `ls -la` |
| 5.10 | Credit usage check: estimate spend after 3 sessions, confirm within budget | Lead | — |

#### Stress Test Criteria (per session)

| Metric | Target | Fail Threshold |
|--------|--------|----------------|
| Crashes / unhandled exceptions | 0 | ≥ 1 |
| Dead air > 2 seconds | 0 | ≥ 2 occurrences |
| Probe relevance (subjective) | High | Off-topic 3× in a row |
| Coverage map updates per session | ≥ 5 | < 3 |
| Session start to first probe | < 50s | > 90s |
| SESSION_END to REPORT_READY | < 120s | > 180s |

#### Phase 5 Exit Gate

```
✅ 3 complete sessions with different JDs complete without crash
✅ CoverageMapViz is visually impressive (smooth transitions, clear color states)
✅ BandEventLog shows model name + provider on every event
✅ Demo script timed: fits in 6 minutes
✅ Demo script rehearsed once
✅ ls -la confirms no questions/ directory, no *.yaml files
✅ Credit estimate: < $1.50 spent across 3 sessions
```

---

### Phase 6 — Submission (Day 6)

**Goal:** Ship it. No new features.

#### Steps

| # | Task | Owner |
|---|------|-------|
| 6.1 | Final smoke test: all 10 model endpoints respond | Lead |
| 6.2 | Record demo video (2 takes, use the better one) | All |
| 6.3 | Write submission text using the pitch from Part XII of spec | Lead |
| 6.4 | Final review: confirm `.env` not in repo | Lead |
| 6.5 | Submit before midnight | Lead |

**Rule:** No new features. No new bug fixes unless show-stopping (crash on happy path).

---

## 5. Intermediate Test Suite

Tests are run at the end of each phase before proceeding. They are not optional.

### T-0: Smoke Tests (Phase 0)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T0-01 | AI/ML API: `deepseek/deepseek-v4-pro` responds | HTTP 200, non-empty content |
| T0-02 | AI/ML API: `Qwen/Qwen3-32B` responds | HTTP 200, non-empty content |
| T0-03 | AI/ML API: `meta-llama/llama-4-scout` responds | HTTP 200, non-empty content |
| T0-04 | AI/ML API: `Qwen/Qwen2.5-72B-Instruct-Turbo` responds | HTTP 200, non-empty content |
| T0-05 | AI/ML API: `Qwen/Qwen3-235B-A22B-fp8-tput` responds | HTTP 200, non-empty content |
| T0-06 | AI/ML API: STT endpoint responds | HTTP 200, generation_id present |
| T0-07 | AI/ML API: TTS (ElevenLabs) responds | HTTP 200, audio URL present |
| T0-08 | AI/ML API: TTS (OpenAI TTS-1) responds | HTTP 200, audio URL present |
| T0-09 | Featherless: `deepseek-ai/DeepSeek-R1` responds | HTTP 200, non-empty content |
| T0-10 | Featherless: `mistralai/Mistral-7B-Instruct-v0.3` responds | HTTP 200, non-empty content |

### T-1: Infrastructure Tests (Phase 1)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T1-01 | Band: publish to Room 1, subscriber in Room 1 receives | Event received within 100ms |
| T1-02 | Band: publish to Room 1 is NOT received by Room 2 subscriber | No cross-room leakage |
| T1-03 | Band: `wait_for("EVENT_TYPE")` resolves on publish | Resolves within 200ms |
| T1-04 | Band: `wait_for` with timeout raises `asyncio.TimeoutError` | Timeout fires correctly |
| T1-05 | VoicePersona: filler fires within 500ms of utterance end | Measured in test harness |
| T1-06 | VoicePersona: STT returns transcript for 5-second audio | Non-empty string returned |
| T1-07 | WebSocket bridge: Band event appears in browser within 1s | BandEventLog renders it |
| T1-08 | End-to-end voice: speak → transcribe → TTS plays back | No error, audio plays |

### T-2: Foundation Room Tests (Phase 2)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T2-01 | RubricSynthesizer: real JD → valid CompetencyGraph JSON | All 6 assertions pass |
| T2-02 | RubricSynthesizer: retries on malformed JSON (inject bad response) | Retries up to 3×, succeeds |
| T2-03 | RubricSynthesizer: fails gracefully after 3 attempts | Raises RuntimeError, not crash |
| T2-04 | CoverageMap: `apply_evidence()` → status transitions correctly | UNEXPLORED→WEAK→COVERED |
| T2-05 | CoverageMap: `select_next_target()` — all UNEXPLORED | Returns highest-weight MUST_HAVE |
| T2-06 | CoverageMap: `select_next_target()` — one WEAK | Returns the WEAK competency |
| T2-07 | CoverageMap: `select_next_target()` — all COVERED | Returns None |
| T2-08 | CoverageMap: `select_next_target()` — MUST_HAVE vs NICE_TO_HAVE | MUST_HAVE wins |
| T2-09 | CoverageMap: `select_next_target()` — all MUST_HAVE COVERED | Returns NICE_TO_HAVE |
| T2-10 | ProbeGenerator: returns probe with `probeText`, `probeId`, `competencyTargeted` | All fields present |
| T2-11 | SessionBrain LangGraph: transitions INIT → RUBRIC → PROBE_CYCLE | No exception thrown |
| T2-12 | Band: `COMPETENCY_GRAPH_READY` published after rubric generation | Event present in log |

### T-3: Exploration Room Tests (Phase 3)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T3-01 | EvidenceChain: both chains run in parallel (timing test) | Total time < max(tech, behav) + 200ms overhead |
| T3-02 | EvidenceChain: tech extraction returns `competencyTags` list | Non-null, valid schema |
| T3-03 | EvidenceChain: behavioral extraction returns `behavioralTags` | Non-null, valid schema |
| T3-04 | EvidenceChain: merged EvidenceNode has all required fields | 10 required fields present |
| T3-05 | EvidenceChain: `overallConfidence` computed correctly | Within 0.01 of manual calc |
| T3-06 | CoverageMap: `apply_evidence()` with negative polarity decreases confidence | Confidence decreases |
| T3-07 | CoverageMap: skill implications applied after direct evidence | Implied competency confidence increases |
| T3-08 | CoverageMapViz: renders in browser without error | No React errors in console |
| T3-09 | CoverageMapViz: updates within 2s of `COVERAGE_MAP_UPDATE` event | Visual change observed |
| T3-10 | Mock session (5 min): at least one UNEXPLORED → WEAK transition | CoverageMapViz shows change |
| T3-11 | Filler cancellation: probe fires within 500ms of filler finishing | No dead air > 1s |
| T3-12 | BandEventLog: every PROBE_GENERATED event shows model name | "Qwen/Qwen3-32B" visible |

### T-4: Integrity & Committee Tests (Phase 4)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T4-01 | IntegritySkeptic: skips evaluation when no high-confidence tags | Returns None, no API call |
| T4-02 | IntegritySkeptic: fires challenge on confidence >= 0.80 vague answer | `shouldChallenge: true` |
| T4-03 | IntegritySkeptic: thinking trace captured from DeepSeek R1 | `thinkingTrace` non-empty |
| T4-04 | IntegritySkeptic: runs as background task (non-blocking) | Next probe fires without waiting |
| T4-05 | CoverageMap: `CONFIDENCE_ADJUSTMENT` lowers confidence correctly | Confidence decreases on adjustment |
| T4-06 | HiringCommittee: 3-round deliberation completes | All 3 committee calls succeed |
| T4-07 | HiringCommittee: `HiringDecision` JSON is valid | All 6 schema assertions pass |
| T4-08 | HiringCommittee: verdict is one of HIRE/NO_HIRE/STRONG_HIRE/HOLD | Enum validation passes |
| T4-09 | ReportGenerator: produces valid HTML report | No broken references, readable |
| T4-10 | Full session: `SESSION_END` → `REPORT_READY` < 120s | Timer measured |
| T4-11 | Band: `INTEGRITY_CHALLENGE` event visible in BandEventLog | Rendered with model name |
| T4-12 | HiringDecision: no competency verdict contains the word "score" | String search confirms |

### T-5: Integration Tests (Phase 5)

| Test ID | Description | Pass Condition |
|---------|-------------|----------------|
| T5-01 | Session 1 (Backend Engineer JD): 0 crashes | Run completes |
| T5-02 | Session 2 (ML Engineer JD): 0 crashes | Run completes |
| T5-03 | Session 3 (Engineering Manager JD): 0 crashes | Run completes |
| T5-04 | Credit check: < $0.50 per session spent | API dashboard verified |
| T5-05 | `ls -la` confirms no `questions/` directory | Directory absent |
| T5-06 | `find . -name "*.yaml"` returns no question files | Zero results (config YAML OK) |
| T5-07 | Demo rehearsal: fits in 6 minutes | Timer confirms |

---

## 6. Acceptance Criteria

These are the non-negotiable conditions for submission. The system fails acceptance if any of these are not met.

### AC-1: Core Mandate

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-1.1 | No question banks exist anywhere in the repository | `ls -la`, `find` commands |
| AC-1.2 | No YAML question files exist | `find . -name "*.yaml"` |
| AC-1.3 | Every probe is generated from the previous utterance at runtime | Code review of `probe_generator.py` |
| AC-1.4 | Hiring decision references specific evidence IDs, not scores | `HiringDecision` JSON inspection |

### AC-2: Multi-Agent Architecture

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-2.1 | All 6 agents are implemented and active during a session | BandEventLog shows events from all 6 agents |
| AC-2.2 | Band event log shows each agent's model name and provider | BandEventLog visual inspection |
| AC-2.3 | Room 1 (Foundation), Room 2 (Exploration), Room 3 (Committee) are distinct | Room IDs in event schema |
| AC-2.4 | DeepSeek R1 thinking trace is visible in the Band log | `thinkingTrace` rendered in UI |

### AC-3: Voice Pipeline

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-3.1 | Candidate can speak naturally into the browser | Live demo |
| AC-3.2 | Perceived dead air after each answer < 1 second | Stop-watch measurement |
| AC-3.3 | Filler phrase fires within 500ms of utterance end | Logs timestamp comparison |
| AC-3.4 | Probes are spoken aloud by ElevenLabs TTS | Audio confirmed in demo |

### AC-4: Coverage Map

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-4.1 | Coverage map updates visually after each candidate answer | CoverageMapViz observed during demo |
| AC-4.2 | Competencies transition UNEXPLORED → WEAK → COVERED | Color change visible |
| AC-4.3 | Coverage map is pure Python deterministic logic (no LLM) | Code review of `coverage_map.py` |
| AC-4.4 | Next probe targets the lowest-coverage MUST_HAVE | BandEventLog `EXPLORATION_TARGET_SELECTED` events |

### AC-5: Hiring Committee

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-5.1 | Committee runs only at `SESSION_END`, not during interview | Code review, event log timing |
| AC-5.2 | 3-agent deliberation: Advocate, Critic, Chair each speak | `deliberationTranscript` in Decision |
| AC-5.3 | Final verdict is one of: HIRE, NO_HIRE, STRONG_HIRE, HOLD | JSON inspection |
| AC-5.4 | All verdicts cite specific `evidenceId` values | JSON inspection |

### AC-6: Performance

| ID | Criterion | Threshold |
|----|-----------|-----------|
| AC-6.1 | Session startup (INIT → first probe) | < 50 seconds |
| AC-6.2 | Per-turn latency (utterance end → probe delivered) | < 5 seconds |
| AC-6.3 | SESSION_END → REPORT_READY | < 120 seconds |
| AC-6.4 | Cost per full demo session | < $0.15 |
| AC-6.5 | Total credit usage across hackathon | < $8 of $10 |

### AC-7: Demo Readiness

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| AC-7.1 | 3 full sessions complete without crash | Test log from Phase 5 |
| AC-7.2 | Demo video recorded and watchable | File exists, plays |
| AC-7.3 | Demo fits in 6 minutes | Timer during rehearsal |
| AC-7.4 | No `.env` file committed to repo | `git log` check |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DeepSeek V4 Pro returns malformed JSON | Medium | High | 3-attempt retry loop in `RubricSynthesizer` |
| STT latency exceeds filler window | Medium | Medium | Use shorter filler phrases; increase timeout to 8s |
| Featherless R1 unavailable during demo | Low | High | Have AI/ML API R1 fallback in `MODELS` dict |
| Credit exhausted during testing | Low | High | Monitor after each session; use `max_tokens=5` smoke tests |
| Probe goes off-topic (no evidence anchoring) | Medium | Medium | Probe prompt includes last 5 conversation turns + competency target |
| Committee call times out (235B is slow) | Medium | Medium | 120s timeout; Chair prompt is short and focused |
| Browser audio playback fails | Low | High | Test on Chrome day 1; have fallback audio element |
| WebSocket disconnects during session | Low | High | Implement auto-reconnect in frontend with 2s backoff |

---

## 8. Progress Tracker

Use this table to track progress during the hackathon. Update at end of each phase.

| Phase | Target Date | Status | Exit Gate Passed | Notes |
|-------|-------------|--------|-----------------|-------|
| Phase 0: Environment Bootstrap | Day 1 AM | ⬜ TODO | ⬜ | |
| Phase 1: Core Infrastructure | Day 1 PM | ⬜ TODO | ⬜ | |
| Phase 2: Foundation Room | Day 2 | ⬜ TODO | ⬜ | |
| Phase 3: Exploration Room | Day 3 | ⬜ TODO | ⬜ | |
| Phase 4: Integrity & Committee | Day 4 | ⬜ TODO | ⬜ | |
| Phase 5: Integration & Polish | Day 5 | ⬜ TODO | ⬜ | |
| Phase 6: Submission | Day 6 | ⬜ TODO | ⬜ | |

**Status key:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ❌ BLOCKED

---

### Session Test Log

| Session # | JD Used | Crashes | Dead Air > 2s | Coverage Updates | Decision Produced | Notes |
|-----------|---------|---------|--------------|-----------------|-------------------|-------|
| Session 1 | Senior Backend Eng | — | — | — | — | |
| Session 2 | Staff ML Eng | — | — | — | — | |
| Session 3 | Eng Manager | — | — | — | — | |

---

*VoiceHire v4 Dev Plan · Band of Agents Hackathon 2026*  
*AI/ML API + Featherless AI · Zero question banks · Zero YAML*  
*Plan version: 1.0 · June 13, 2026*
