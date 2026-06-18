import asyncio, json, websockets, os, httpx
from dotenv import load_dotenv
load_dotenv()

BAND_API_KEY = os.environ['BRANDAPIKEY']
ws_url = f"wss://app.band.ai/api/v1/socket/websocket?api_key={BAND_API_KEY}&vsn=2.0.0"
room_id = "140ac7d0-2242-4485-8996-d411f157e7ef"
rubric_id = "ce01910c-d27b-46e6-8536-f81e06221711"

async def test():
    print("Connecting...")
    async with websockets.connect(ws_url) as ws:
        print("Connected!")
        ref = 1
        payload = [str(ref), str(ref), f"chat_room:{room_id}", "phx_join", {}]
        await ws.send(json.dumps(payload))
        print("Sent phx_join")
        
        for i in range(3):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                arr = json.loads(raw)
                event = arr[3] if len(arr) > 3 else "?"
                print(f"Recv {i}: event={event}")
                if len(arr) > 4:
                    print(f"  payload: {json.dumps(arr[4])[:300]}")
            except asyncio.TimeoutError:
                print(f"Recv {i}: timeout")
                break
        
        print("Posting test message...")
        token = os.environ['BAND_TOKEN_SESSION_BRAIN']
        headers = {"X-API-Key": token, "Content-Type": "application/json"}
        async with httpx.AsyncClient(base_url="https://app.band.ai/api/v1", headers=headers) as c:
            r = await c.post(f"/agent/chats/{room_id}/messages", json={
                "message": {"content": "WS TEST 2: checking real-time delivery", "mentions": [{"id": rubric_id}]}
            })
            print(f"Posted: {r.status_code}")
        
        for i in range(5):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                arr = json.loads(raw)
                event = arr[3] if len(arr) > 3 else "?"
                print(f"Recv after post {i}: event={event}")
                if len(arr) > 4:
                    content = arr[4].get("content", "")[:100]
                    print(f"  content: {content}")
            except asyncio.TimeoutError:
                print("Timeout waiting for message")
                break

asyncio.run(test())
