"""
Phase 5: 3-Session Stress Test
Backend, ML, Manager JDs — measures per-phase latency + dead air gaps.
"""

import asyncio
import json
import os
import sys
import time
import uuid
import httpx
import websockets

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import BAND_API_KEY, BAND_WS_URL, BAND_API_BASE

SERVER_URL = "http://localhost:8000"
WS_URL = f"{BAND_WS_URL}?api_key={BAND_API_KEY}&vsn=2.0.0"

# Realistic JDs for stress testing
JDS = {
    "Backend Engineer": """We are hiring a Senior Backend Engineer for our fintech platform.
Responsibilities: Design and build RESTful APIs processing 10M+ requests/day.
Architect PostgreSQL schemas for financial transactions with ACID compliance.
Implement Redis caching layer reducing P99 latency below 50ms.
Deploy Kubernetes services on AWS EKS with canary deployments.
Mentor 3 junior engineers through code reviews and pair programming.
Must have: Python, async programming, distributed systems, CI/CD.""",

    "ML Engineer": """We need an ML Engineer for our recommendation systems team.
Responsibilities: Train and deploy transformer-based recommendation models serving 5M users.
Build feature pipelines processing 2TB/day of user behavior data.
Optimize model inference latency to under 100ms on GPU infrastructure.
Implement online learning pipelines for real-time model updates.
Experience: PyTorch, distributed training (FSDP/DeepSpeed), knowledge of RAG architectures.
Must have: MLOps, model monitoring, A/B experimentation frameworks.""",

    "Engineering Manager": """We are looking for an Engineering Manager for our Platform team.
Responsibilities: Lead a team of 8 engineers across 2 time zones.
Drive quarterly OKRs and sprint planning with 2-week cadences.
Conduct performance reviews, career development, and technical interviews.
Own the incident response process with SLA targets of 15-minute MTTR.
Manage infrastructure budget of $50K/month across AWS, GCP, and Cloudflare.
Must have: 5+ years engineering management, hands-on coding ability, agile transformation.""",
}

PASS = 0
FAIL = 0
TIMINGS = []


def log(msg: str):
    print(f"  {msg}", flush=True)


async def connect_ws():
    ws = await websockets.connect(WS_URL)
    ref = 0
    return ws, ref


async def subscribe_room(ws, ref: int, room_id: str) -> int:
    ref += 1
    await ws.send(json.dumps([str(ref), str(ref), f"chat_room:{room_id}", "phx_join", {}]))
    return ref


async def wait_for_event(ws, prefix: str, timeout: float = 45.0) -> tuple[str, float]:
    start = time.time()
    while time.time() - start < timeout:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        try:
            arr = json.loads(raw)
            if not isinstance(arr, list) or len(arr) < 5:
                continue
            _jr, _r, topic, event, payload = arr[0], arr[1], arr[2], arr[3], arr[4]
            if event in ("message_created", "event_created"):
                content = payload.get("content", "")
                if content.startswith(prefix):
                    ts = time.time()
                    return content, ts
            if event == "phx_reply":
                continue
        except (json.JSONDecodeError, asyncio.TimeoutError):
            continue
    raise TimeoutError(f"Timed out waiting for {prefix}")


async def send_audio_chunk(session_id: str):
    """Send a small synthetic audio chunk to simulate a candidate utterance."""
    # Minimal valid WebM preamble (silence) — enough for STT to return empty transcript
    min_webm = bytes([
        0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x1f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42,
        0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84,
        0x77, 0x65, 0x62, 0x6d, 0x44, 0x85, 0x81, 0x02, 0x63, 0xa5,
        0x81, 0x02,
    ])
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{SERVER_URL}/session/{session_id}/audio",
            files={"audio": ("chunk.webm", min_webm, "audio/webm")},
        )
        return r.status_code == 200


async def run_session(name: str, jd_text: str) -> dict:
    global PASS, FAIL
    print(f"\n{'='*60}")
    print(f"  Session: {name}")
    print(f"{'='*60}")

    timings = {"session": name}
    ws = None

    try:
        # Step 1: POST /session/create
        t0 = time.time()
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{SERVER_URL}/session/create",
                data={"jd": jd_text, "resume": "Senior engineer with 8 years experience.", "rubric": "", "role_level": "senior"},
            )
            assert r.status_code == 200, f"Session create failed: {r.status_code}"
            data = r.json()
        t_create = time.time() - t0
        timings["create_session"] = round(t_create, 2)
        log(f"Session created: {data['session_id']} ({t_create:.1f}s)")

        room_ids = [data["foundation_room_id"], data["exploration_room_id"], data["committee_room_id"]]
        sid = data["session_id"]

        # Step 2: Connect WS and subscribe
        t1 = time.time()
        ws, ref = await connect_ws()
        for rid in room_ids:
            ref = await subscribe_room(ws, ref, rid)
        t_sub = time.time() - t1
        timings["subscribe_ws"] = round(t_sub, 2)
        log(f"WS subscribed to 3 rooms ({t_sub:.1f}s)")

        # Step 3: Wait for COMPETENCY_GRAPH_READY
        t2 = time.time()
        content, ts = await wait_for_event(ws, "COMPETENCY_GRAPH_READY:", timeout=45.0)
        t_graph = ts - t2
        timings["competency_graph"] = round(t_graph, 2)
        log(f"COMPETENCY_GRAPH_READY: +{t_graph:.1f}s")

        # Verify graph has competencies
        graph_json = content.split(":", 1)[1].strip()
        graph = json.loads(graph_json)
        n_comps = len(graph.get("competencies", []))
        timings["num_competencies"] = n_comps
        log(f"  {n_comps} competencies")

        # Step 4: Wait for COVERAGE_MAP_INIT
        content, ts = await wait_for_event(ws, "COVERAGE_MAP_INIT:", timeout=10.0)
        t_init = ts - t2
        timings["coverage_map_init"] = round(t_init, 2)
        log(f"COVERAGE_MAP_INIT: +{t_init:.1f}s")

        # Step 5: Wait for first PROBE_GENERATED
        content, ts = await wait_for_event(ws, "PROBE_GENERATED:", timeout=15.0)
        t_probe = ts - t2
        timings["first_probe"] = round(t_probe, 2)
        timings["total_to_first_probe"] = round(ts - t0, 2)
        log(f"PROBE_GENERATED: +{t_probe:.1f}s")
        log(f"  Total: {ts-t0:.1f}s to first probe")

        # Step 6: Simulate candidate utterance → wait for COVERAGE_MAP_UPDATE
        t3 = time.time()
        ok = await send_audio_chunk(sid)
        if ok:
            log(f"Audio chunk sent")
        else:
            log(f"  [WARN] Audio chunk failed")

        # Wait for COVERAGE_MAP_UPDATE (from evidence chain → session brain)
        try:
            content, ts = await wait_for_event(ws, "COVERAGE_MAP_UPDATE:", timeout=30.0)
            t_update = ts - t3
            timings["coverage_map_update"] = round(t_update, 2)
            timings["dead_air_after_utterance"] = round(t_update, 2)
            log(f"COVERAGE_MAP_UPDATE: +{t_update:.1f}s (dead air gap)")
        except TimeoutError:
            log(f"  [WARN] No COVERAGE_MAP_UPDATE within 30s — pipeline incomplete")
            timings["coverage_map_update"] = "TIMEOUT"
            timings["dead_air_after_utterance"] = "TIMEOUT"

        # Step 7: Wait for second probe
        try:
            content, ts = await wait_for_event(ws, "PROBE_GENERATED:", timeout=15.0)
            t_probe2 = ts - t3
            timings["second_probe"] = round(t_probe2, 2)
            log(f"Second PROBE_GENERATED: +{t_probe2:.1f}s")
        except TimeoutError:
            log(f"  [WARN] No second probe within 15s")
            timings["second_probe"] = "TIMEOUT"

        PASS += 1
        TIMINGS.append(timings)
        return timings

    except Exception as e:
        log(f"  [FAIL] {e}")
        FAIL += 1
        TIMINGS.append({**timings, "error": str(e)})
        return timings
    finally:
        if ws:
            await ws.close()


async def main():
    print("=" * 60)
    print("  VoiceHire Phase 5: 3-Session Stress Test")
    print("=" * 60)

    # Verify server is running
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{SERVER_URL}/session/nonexistent/status")
    except Exception:
        print("\n  [ERROR] Server not running at", SERVER_URL)
        print("  Start with: uvicorn voicehire.api.server:app --reload")
        sys.exit(1)

    for name, jd in JDS.items():
        await run_session(name, jd)
        await asyncio.sleep(2)  # Cool-down between sessions

    # Summary
    print(f"\n{'='*60}")
    print(f"  RESULTS: {PASS}/{PASS + FAIL} passed")
    print(f"{'='*60}")
    if TIMINGS:
        print(f"\n  Per-Session Timings:")
        print(f"  {'Session':<25} {'Create':<8} {'Graph':<8} {'Probe1':<8} {'Update':<8} {'Total':<8}")
        print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
        for t in TIMINGS:
            name = t["session"][:25]
            create = t.get("create_session", "?")
            graph = t.get("competency_graph", "?")
            probe = t.get("first_probe", "?")
            update = t.get("coverage_map_update", "?")
            total = t.get("total_to_first_probe", "?")
            print(f"  {name:<25} {str(create):<8} {str(graph):<8} {str(probe):<8} {str(update):<8} {str(total):<8}")

        # Dead air check
        dead_airs = [t.get("dead_air_after_utterance") for t in TIMINGS if isinstance(t.get("dead_air_after_utterance"), (int, float))]
        if dead_airs:
            max_da = max(dead_airs)
            print(f"\n  Dead air (utterance → COVERAGE_MAP_UPDATE):")
            print(f"    Max: {max_da:.1f}s  {'✅ < 1s' if max_da < 1.0 else '❌ > 1s — needs optimization'}")
            avg_da = sum(dead_airs) / len(dead_airs)
            print(f"    Avg: {avg_da:.1f}s")

    print(f"\n  {'✅ ALL PASSED' if FAIL == 0 else '❌ SOME FAILED'}")


if __name__ == "__main__":
    asyncio.run(main())
