import httpx
import os
from dataclasses import dataclass
from config import BAND_API_KEY, BAND_API_BASE, BAND_WS_URL, BAND_AUTH_HEADER


@dataclass
class BandSession:
    session_id: str
    foundation_room_id: str
    exploration_room_id: str
    committee_room_id: str
    ws_url: str


AGENT_HANDLES = {
    "session-brain":      "BAND_TOKEN_SESSION_BRAIN",
    "rubric-synthesizer": "BAND_TOKEN_RUBRIC_SYNTHESIZER",
    "voice-persona":      "BAND_TOKEN_VOICE_PERSONA",
    "evidence-chain":     "BAND_TOKEN_EVIDENCE_CHAIN",
    "integrity-skeptic":  "BAND_TOKEN_INTEGRITY_SKEPTIC",
    "hiring-committee":   "BAND_TOKEN_HIRING_COMMITTEE",
}


class BandSessionFactory:
    """Creates 3 Band Chat Rooms per session using Agent API."""

    def __init__(self):
        self._http = httpx.Client(base_url=BAND_API_BASE, headers={
            BAND_AUTH_HEADER: BAND_API_KEY, "Content-Type": "application/json",
        })
        self._agent_id_map: dict[str, str] | None = None

    def _load_agent_ids(self) -> dict[str, str]:
        if self._agent_id_map is not None:
            return self._agent_id_map
        r = self._http.get("/me/agents")
        r.raise_for_status()
        agents = r.json().get("data", [])
        self._agent_id_map = {}
        for a in agents:
            handle = a.get("handle", "").split("/")[-1]  # "owner/handle" -> "handle"
            self._agent_id_map[a["name"]] = {"id": a["id"], "handle": handle}
        return self._agent_id_map

    def create_session(self, session_id: str) -> BandSession:
        agent_ids = self._load_agent_ids()

        # Resolve owner user UUID from /me
        me = self._http.get("/me").json()
        owner_id = me["data"]["user"]["id"]
        print(f"  Owner user ID: {owner_id[:8]}...")

        # Use session-brain agent token for room creation
        brain_token = os.environ["BAND_TOKEN_SESSION_BRAIN"]
        brain_headers = {"X-API-Key": brain_token, "Content-Type": "application/json"}
        agent = httpx.Client(base_url=BAND_API_BASE, headers=brain_headers)

        foundation_id  = self._agent_create_room(agent, f"voicehire-{session_id}-foundation")
        exploration_id = self._agent_create_room(agent, f"voicehire-{session_id}-exploration")
        committee_id   = self._agent_create_room(agent, f"voicehire-{session_id}-committee")

        # Add owner (human) to all rooms so WS subscription works
        for rid in [foundation_id, exploration_id, committee_id]:
            self._agent_add_participant_by_id(agent, rid, owner_id, "Owner")

        # Add agents via Agent API (session-brain adds sibling agents)
        self._agent_add_participant(agent, foundation_id,  agent_ids, "Rubric Synthesizer")
        self._agent_add_participant(agent, exploration_id, agent_ids, "Voice Persona")
        self._agent_add_participant(agent, exploration_id, agent_ids, "Evidence Chain")
        self._agent_add_participant(agent, exploration_id, agent_ids, "Integrity Skeptic")
        self._agent_add_participant(agent, committee_id,   agent_ids, "Hiring Committee")

        agent.close()

        return BandSession(
            session_id=session_id,
            foundation_room_id=foundation_id,
            exploration_room_id=exploration_id,
            committee_room_id=committee_id,
            ws_url=BAND_WS_URL,
        )

    def _agent_create_room(self, agent: httpx.Client, title: str) -> str:
        r = agent.post("/agent/chats", json={"chat": {"title": title}})
        r.raise_for_status()
        room_id = r.json()["data"]["id"]
        print(f"  Created room '{title}' -> {room_id}")
        return room_id

    def _agent_add_participant_by_id(self, agent: httpx.Client, room_id: str,
                                      participant_id: str, label: str) -> None:
        r = agent.post(f"/agent/chats/{room_id}/participants",
                        json={"participant": {"participant_id": participant_id}})
        if r.is_success:
            print(f"  Added '{label}' to {room_id[:8]}...")
        elif r.status_code == 422 and "already" in r.text:
            print(f"  [SKIP] '{label}' already in {room_id[:8]}...")
        else:
            print(f"  [WARN] Failed to add '{label}': {r.status_code} {r.text[:120]}")

    def _agent_add_participant(self, agent: httpx.Client, room_id: str,
                                agent_ids: dict, agent_name: str) -> None:
        info = agent_ids.get(agent_name)
        if not info:
            print(f"  [WARN] Agent '{agent_name}' not found in registered agents")
            return
        r = agent.post(f"/agent/chats/{room_id}/participants",
                        json={"participant": {"participant_id": info["id"]}})
        if r.is_success:
            print(f"  Added '{agent_name}' ({info['handle']}) to {room_id[:8]}...")
        elif r.status_code == 422 and "already" in r.text:
            print(f"  [SKIP] '{agent_name}' already in {room_id[:8]}...")
        else:
            print(f"  [WARN] Failed to add '{agent_name}': {r.status_code} {r.text[:120]}")

    def get_agent_id(self, agent_name: str) -> str | None:
        """Return agent UUID by name. Loads map if not yet loaded."""
        ids = self._load_agent_ids()
        info = ids.get(agent_name)
        return info["id"] if info else None

    def close(self):
        self._http.close()
