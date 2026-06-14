import asyncio, json, websockets, os
from dotenv import load_dotenv
load_dotenv()

BAND_API_KEY = os.environ['BRANDAPIKEY']
ws_url = f"wss://app.band.ai/api/v1/socket/websocket?api_key={BAND_API_KEY}&vsn=2.0.0"

async def check_events():
    async with websockets.connect(ws_url) as ws:
        ref = 0
        # Subscribe to Foundation room
        ref += 1
        await ws.send(json.dumps([str(ref), str(ref), "chat_room:4230e17f-5d08-4071-a096-72cc6122ddc9", "phx_join", {}]))
        # Subscribe to Exploration room  
        ref += 1
        await ws.send(json.dumps([str(ref), str(ref), "chat_room:eb47059b-a57b-4dab-9800-2b118cd39e69", "phx_join", {}]))
        
        # Wait for join replies
        for _ in range(2):
            await asyncio.wait_for(ws.recv(), timeout=5)
        
        # Now get recent events by reading for 10s
        events = []
        print("Listening for events...")
        deadline = asyncio.get_event_loop().time() + 10
        while asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                arr = json.loads(raw)
                if len(arr) >= 5:
                    event = arr[3]
                    content = arr[4].get("content", "")[:100]
                    if event in ("event_created", "message_created"):
                        events.append(f"  {event}: {content}")
            except asyncio.TimeoutError:
                pass
        
        print(f"Events/messages received: {len(events)}")
        for ev in events:
            print(ev)

asyncio.run(check_events())
