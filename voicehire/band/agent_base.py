import httpx
import json
import os
from abc import ABC, abstractmethod
from config import BAND_API_BASE


class BandAgent(ABC):
    """Base class for all VoiceHire agents registered in Band platform."""

    def __init__(self, handle: str, token_env_var: str):
        self.handle = handle
        self.token = os.environ[token_env_var]
        self.headers = {
            "X-API-Key": self.token,
            "Content-Type": "application/json",
        }
        self._http = httpx.AsyncClient(base_url=BAND_API_BASE, headers=self.headers)

    async def send_message(self, room_id: str, content: str, mention_ids: list[str] | None = None) -> dict:
        """Post a message mentioning specific agents."""
        message = {"content": content}
        if mention_ids:
            message["mentions"] = [{"id": uid} for uid in mention_ids]
        payload = {"message": message}
        try:
            r = await self._http.post(
                f"/agent/chats/{room_id}/messages",
                json=payload,
            )
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            print(f"[agent_base] HTTP error: {e.response.status_code}, body: {e.response.text[:500]}")
            raise

    async def send_to_agent(self, room_id: str, agent_name: str, agent_id: str, content: str) -> dict:
        """Send a message @mentioning a specific agent by UUID."""
        return await self.send_message(
            room_id, f"@{agent_name} {content}", mention_ids=[agent_id],
        )

    async def send_event(self, room_id: str, content: str,
                          message_type: str = "task") -> dict:
        """Post an event to a Band room (no mentions required).

        Events appear in the WebSocket feed and are visible to all
        participants, making them ideal for data broadcasts like
        SPEAK:, UTTERANCE:, etc.
        """
        r = await self._http.post(
            f"/agent/chats/{room_id}/events",
            json={"event": {"content": content, "message_type": message_type}},
        )
        r.raise_for_status()
        return r.json()

    async def list_messages(self, room_id: str, limit: int = 50) -> list[dict]:
        r = await self._http.get(f"/agent/chats/{room_id}/messages", params={"limit": limit})
        r.raise_for_status()
        messages = r.json().get("data", [])
        if not messages:
            messages = r.json().get("messages", [])
        return messages

    async def mark_processing(self, room_id: str, message_id: str) -> None:
        try:
            await self._http.post(f"/agent/chats/{room_id}/messages/{message_id}/processing")
            print(f"[{self.handle}] Marked message {message_id[:8]}... as processing")
        except Exception as e:
            print(f"[{self.handle}] Failed to mark processing for {message_id[:8]}...: {e}")

    async def mark_processed(self, room_id: str, message_id: str) -> None:
        try:
            await self._http.post(f"/agent/chats/{room_id}/messages/{message_id}/processed")
            print(f"[{self.handle}] Marked message {message_id[:8]}... as processed")
        except Exception as e:
            print(f"[{self.handle}] Failed to mark processed for {message_id[:8]}...: {e}")

    async def mark_failed(self, room_id: str, message_id: str, error: str) -> None:
        try:
            await self._http.post(
                f"/agent/chats/{room_id}/messages/{message_id}/failed",
                json={"error": error},
            )
            print(f"[{self.handle}] Marked message {message_id[:8]}... as failed: {error}")
        except Exception as e:
            print(f"[{self.handle}] Failed to mark failed for {message_id[:8]}...: {e}")

    async def close(self):
        await self._http.aclose()

    @abstractmethod
    async def handle_mention(self, room_id: str, message: dict) -> None:
        """Called when this agent is @mentioned in a room."""
