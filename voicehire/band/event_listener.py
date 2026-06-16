import asyncio
import json
import sys
import websockets
from config import BAND_API_KEY, BAND_WS_URL


def _log(msg: str) -> None:
    print(msg, flush=True)

EVENT_ROUTES = {
    "COMPETENCY_GRAPH_READY": "session-brain",
    "CANDIDATE_UTTERANCE": "session-brain",
    "CANDIDATE_IDENTIFIED": "session-brain",
    "CANDIDATE_FINISHED": "session-brain",
    "CANDIDATE_CONNECTED": "session-brain",
    "CANDIDATE_DISCONNECTED": None,
    "COVERAGE_MAP_UPDATE": None,
    "COVERAGE_MAP_INIT": None,
    "PROBE_GENERATED": None,
    "SPEAK": None,
    "EVIDENCE": "session-brain",
    "CHALLENGE": "session-brain",
    "EARLY_COMPLETION": None,
    "COMMITTEE_DECISION": None,
    "REPORT_READY": None,
}


class AgentRegistry:
    """Maps agent handles and UUIDs to agent instances."""

    def __init__(self):
        self._agents: dict[str, object] = {}
        self._uuid_map: dict[str, str] = {}

    def register(self, handle: str, agent_uuid: str, instance: object) -> None:
        self._agents[handle] = instance
        self._uuid_map[agent_uuid] = handle

    def get_by_handle(self, handle: str) -> object | None:
        return self._agents.get(handle)

    def get_by_uuid(self, agent_uuid: str) -> object | None:
        handle = self._uuid_map.get(agent_uuid)
        return self._agents.get(handle) if handle else None

    def route_event(self, content: str) -> list[tuple[str, object]]:
        results = []
        for prefix, handle in EVENT_ROUTES.items():
            if content.startswith(prefix + ":") and handle and handle in self._agents:
                results.append((handle, self._agents[handle]))
        return results


class BandEventListener:
    """Phoenix Channels WebSocket listener for Band platform.

    Connects to wss://app.band.ai/api/v1/socket/websocket, subscribes to
    session rooms, and routes incoming messages to registered agents.
    """

    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        self._subscribed_rooms: set[str] = set()
        self._confirmed_rooms: set[str] = set()
        self._task: asyncio.Task | None = None
        self._running = False
        self._ref = 0
        self._ws = None
        self._pending_joins: dict[str, asyncio.Event] = {}

    async def start(self) -> None:
        self._running = True
        self._task = asyncio.create_task(self._listen_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._ws:
            await self._ws.close()

    async def subscribe_to_rooms(self, room_ids: list[str]) -> None:
        new_rooms = []
        for rid in room_ids:
            if rid not in self._subscribed_rooms:
                self._subscribed_rooms.add(rid)
                new_rooms.append(rid)
        if new_rooms and self._ws:
            await self._subscribe_rooms(self._ws, new_rooms)
            # Wait for all phx_reply confirmations concurrently (20s timeout each)
            async def _wait_confirm(rid: str) -> None:
                evt = self._pending_joins.get(rid)
                if evt:
                    try:
                        await asyncio.wait_for(evt.wait(), timeout=5)
                        print(f"[event-listener] Confirmed subscription: {rid[:8]}...")
                    except asyncio.TimeoutError:
                        print(f"[event-listener] Room {rid[:8]}... subscription active (no phx_reply)")
            await asyncio.gather(*[_wait_confirm(rid) for rid in new_rooms])
        print(f"[event-listener] Subscribed rooms: {[r[:8] for r in self._subscribed_rooms]}")

    async def _subscribe_rooms(self, ws, room_ids: list[str]) -> None:
        async def _send_join(room_id: str) -> None:
            self._ref += 1
            ref = str(self._ref)
            self._pending_joins[room_id] = asyncio.Event()
            payload = [ref, ref, f"chat_room:{room_id}", "phx_join", {}]
            await ws.send(json.dumps(payload))
            print(f"[event-listener] Sent phx_join for chat_room:{room_id[:8]}...")
        # Send all phx_joins concurrently (no serial 20s waits)
        await asyncio.gather(*[_send_join(rid) for rid in room_ids])

    def unsubscribe_from_rooms(self, room_ids: list[str]) -> None:
        for rid in room_ids:
            self._subscribed_rooms.discard(rid)

    async def _listen_loop(self) -> None:
        while self._running:
            try:
                ws_url = f"{BAND_WS_URL}?api_key={BAND_API_KEY}&vsn=2.0.0"
                print(f"[event-listener] Connecting to Band WS...")
                async with websockets.connect(ws_url) as ws:
                    self._ws = ws
                    print(f"[event-listener] Connected")
                    await self._subscribe_rooms(ws, list(self._subscribed_rooms))

                    heartbeat_task = asyncio.create_task(self._heartbeat(ws))

                    try:
                        while self._running:
                            raw = await asyncio.wait_for(ws.recv(), timeout=30)
                            await self._handle_message(raw)
                    except asyncio.TimeoutError:
                        pass
                    finally:
                        heartbeat_task.cancel()
                        try:
                            await heartbeat_task
                        except asyncio.CancelledError:
                            pass
                    self._ws = None

            except (websockets.exceptions.ConnectionClosed, OSError) as e:
                print(f"[event-listener] Connection lost: {e}, reconnecting in 3s...")
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[event-listener] Unexpected error: {e}, reconnecting in 3s...")
                await asyncio.sleep(3)

    async def _subscribe_all(self, ws) -> None:
        for room_id in self._subscribed_rooms:
            self._ref += 1
            ref = str(self._ref)
            payload = [ref, ref, f"chat_room:{room_id}", "phx_join", {}]
            await ws.send(json.dumps(payload))
            print(f"[event-listener] Subscribed to chat_room:{room_id[:8]}...")

    async def _heartbeat(self, ws) -> None:
        while self._running:
            await asyncio.sleep(25)
            self._ref += 1
            ref = str(self._ref)
            payload = [None, ref, "phoenix", "heartbeat", {}]
            try:
                await ws.send(json.dumps(payload))
            except Exception:
                break

    async def _handle_message(self, raw: str) -> None:
        try:
            arr = json.loads(raw)
            if not isinstance(arr, list) or len(arr) < 5:
                return
            _join_ref, _ref, topic, event, payload = arr[0], arr[1], arr[2], arr[3], arr[4]

            if event == "phx_reply":
                reply = payload.get("response", {})
                status = reply.get("status", "")
                if status:
                    print(f"[event-listener] {topic} {event}: {status}")
                if status == "ok" and topic.startswith("chat_room:"):
                    room_id = topic.replace("chat_room:", "")
                    self._confirmed_rooms.add(room_id)
                    evt = self._pending_joins.get(room_id)
                    if evt:
                        evt.set()
                return

            if event not in ("message_created", "event_created"):
                return

            content = payload.get("content", "")
            if not content:
                return

            room_id = topic.replace("chat_room:", "") if topic.startswith("chat_room:") else None

            if event == "message_created":
                await self._route_message(room_id, payload, content)
            elif event == "event_created":
                await self._route_event(room_id, content)

        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f"[event-listener] Error handling message: {e}")

    async def _route_message(self, room_id: str | None, payload: dict, content: str) -> None:
        metadata = payload.get("metadata", {})
        mentions = metadata.get("mentions", [])
        for mention in mentions:
            mention_id = mention.get("id", "")
            agent = self.registry.get_by_uuid(mention_id)
            if agent and hasattr(agent, "handle_mention"):
                print(f"[event-listener] Routing @mention to {agent.handle}")
                try:
                    await agent.handle_mention(room_id or "", payload)
                except Exception as e:
                    print(f"[event-listener] Agent {agent.handle} raised: {e}")
                if hasattr(self, 'relay_fn') and self.relay_fn:
                    await self.relay_fn(room_id or "", "message_created", payload)
                return
        if hasattr(self, 'relay_fn') and self.relay_fn:
            await self.relay_fn(room_id or "", "message_created", payload)

    async def _route_event(self, room_id: str | None, content: str) -> None:
        routes = self.registry.route_event(content)
        for handle, agent in routes:
            if hasattr(agent, "handle_mention"):
                print(f"[event-listener] Routing event '{content[:60]}...' to {handle}")
                try:
                    await agent.handle_mention(room_id or "", {"content": content})
                except Exception as e:
                    print(f"[event-listener] Agent {handle} raised: {e}")
        if hasattr(self, 'relay_fn') and self.relay_fn:
            sender = "system"
            for prefix, agent_handle in EVENT_ROUTES.items():
                if content.startswith(prefix + ":"):
                    if agent_handle:
                        sender = f"@{agent_handle}"
                    break
            from datetime import datetime
            await self.relay_fn(room_id or "", "event_created", {
                "content": content,
                "sender_name": sender,
                "inserted_at": datetime.utcnow().isoformat(),
            })
