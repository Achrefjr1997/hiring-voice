"""Comprehensive test: Agent API flows (events, messages, participants, WS)."""
import sys, json, os, asyncio, uuid, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from config import BAND_API_BASE, BAND_API_KEY
from voicehire.band.session_factory import BandSessionFactory


factory = BandSessionFactory()
session_id = uuid.uuid4().hex[:8]

print("=== Phase 1: Create Session (3 rooms) ===")
session = factory.create_session(session_id)
fid, eid, cid = session.foundation_room_id, session.exploration_room_id, session.committee_room_id
print(f"  Foundation:  {fid}")
print(f"  Exploration: {eid}")
print(f"  Committee:   {cid}")

# Collect agent IDs
agent_map = {}
brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
brain_h = {"X-API-Key": brain_token, "Content-Type": "application/json"}
agent = httpx.Client(base_url=BAND_API_BASE, headers=brain_h)

for room_id, room_name in [(fid, "foundation"), (eid, "exploration"), (cid, "committee")]:
    r = agent.get(f"/agent/chats/{room_id}/participants")
    for p in r.json().get("data", []):
        agent_map[p["name"]] = {"id": p["id"], "handle": p.get("handle", "")}
    print(f"  {room_name}: {len(r.json().get('data',[]))} participants")

for name, info in sorted(agent_map.items()):
    print(f"  Agent: {name} -> id={info['id'][:8]}...")

print("\n=== Phase 2: Send Event (no mentions) ===")
r = agent.post(f"/agent/chats/{fid}/events", json={
    "event": {"content": "COMPETENCY_GRAPH_READY: Senior Python dev", "message_type": "task"}
})
assert r.is_success, f"Event post failed: {r.text[:200]}"
print(f"  Event created: {r.json()['data']['id'][:8]}...")

print("\n=== Phase 3: Send Message (with mentions) ===")
rubric_id = agent_map.get("Rubric Synthesizer", {}).get("id")
assert rubric_id, "No Rubric Synthesizer found"
r = agent.post(f"/agent/chats/{fid}/messages", json={
    "message": {
        "content": "@Rubric Synthesizer RUBRIC_READY: Async, testing, system design",
        "mentions": [{"id": rubric_id}],
    }
})
assert r.is_success, f"Message post failed: {r.text[:200]}"
print(f"  Message created: {r.json()['data']['id'][:8]}...")

print("\n=== Phase 4: Read Messages (as rubric-synthesizer) ===")
rubric_token = os.environ["BAND_TOKEN_RUBRIC_SYNTHESIZER"]
rubric = httpx.Client(base_url=BAND_API_BASE, headers={
    "X-API-Key": rubric_token, "Content-Type": "application/json",
})
r2 = rubric.get(f"/agent/chats/{fid}/messages")
assert r2.is_success, f"Get messages failed: {r2.text[:200]}"
msgs = r2.json().get("data", [])
print(f"  Messages in room: {len(msgs)}")
for m in msgs[-3:]:
    print(f"    [{m.get('message_type','text')}] {m.get('content','')[:80]}")
rubric.close()

print("\n=== Phase 5: Agent Cross-Room Communication ===")
# Voice Persona sends to exploration room
vp_token = os.environ["BAND_TOKEN_VOICE_PERSONA"]
vp = httpx.Client(base_url=BAND_API_BASE, headers={
    "X-API-Key": vp_token, "Content-Type": "application/json",
})

# Get voice persona's own ID for self-mention (event doesn't need mention)
vp_id = agent_map.get("Voice Persona", {}).get("id")
r = vp.post(f"/agent/chats/{eid}/events", json={
    "event": {"content": "SPEAK: Welcome to the interview", "message_type": "task"},
})
assert r.is_success, f"VP event failed: {r.text[:200]}"
print(f"  VP event created: {r.json()['data']['id'][:8]}...")

# VP sends a message to evidence-chain
ec_id = agent_map.get("Evidence Chain", {}).get("id")
if ec_id:
    r = vp.post(f"/agent/chats/{eid}/messages", json={
        "message": {
            "content": "@Evidence Chain UTTERANCE: I have 5 years of Python experience",
            "mentions": [{"id": ec_id}],
        }
    })
    assert r.is_success, f"VP message failed: {r.text[:200]}"
    print(f"  VP->Evidence Chain message created")
vp.close()

print("\n=== Phase 6: Verify via WS (Human API key auth) ===")
# Test WS with correct auth params
import websockets

async def ws_test():
    ws_url = f"wss://app.band.ai/api/v1/socket/websocket?api_key={BAND_API_KEY}&vsn=2.0.0"
    print(f"  Connecting to WS...")
    async with websockets.connect(ws_url) as ws:
        print(f"  Connected!")
        ref = 1
        events_received = []

        # Subscribe to 3 rooms
        for rid in [fid, eid, cid]:
            payload = [str(ref), str(ref), f"chat_room:{rid}", "phx_join", {}]
            await ws.send(json.dumps(payload))
            ref += 1

        # Wait for join replies
        for _ in range(3):
            resp = await asyncio.wait_for(ws.recv(), timeout=5)
            print(f"  Join resp: {resp[:100]}...")

        # Create another event via API while WS is listening
        r_event = agent.post(f"/agent/chats/{fid}/events", json={
            "event": {"content": "TEST: WS real-time event", "message_type": "task"},
        })
        if r_event.is_success:
            print(f"  Test event posted")

        # Create a message with mention while WS is listening
        r_msg = agent.post(f"/agent/chats/{fid}/messages", json={
            "message": {
                "content": "@Rubric Synthesizer TEST: WS real-time message",
                "mentions": [{"id": rubric_id}],
            }
        })
        if r_msg.is_success:
            print(f"  Test message posted")

        # Collect WS events for 5 seconds
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                resp = await asyncio.wait_for(ws.recv(), timeout=2)
                events_received.append(resp[:200])
            except asyncio.TimeoutError:
                break

        await ws.close()
        return events_received

ws_events = asyncio.run(ws_test())
print(f"  WS events received: {len(ws_events)}")
for ev in ws_events:
    print(f"    {ev[:120]}")

agent.close()
print(f"\n=== ALL OK ===")
