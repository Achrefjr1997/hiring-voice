import asyncio
import json
import os
import uuid

from voicehire.band.agent_base import BandAgent
from voicehire.voice.tts import stream_tts
from config import DEEPGRAM_KEY, TTS_FILLER_MODEL, TTS_PROBE_MODEL, TTS_FORMAT

FILLER_PHRASES = [
    "That's an interesting angle. Let me think about where to take this next.",
    "Good. There's a specific area I want to probe on that.",
    "Right, and that connects to something I want to explore with you.",
    "Noted. Give me just a moment here.",
    "Interesting. I want to dig into that a bit more.",
]

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "audio_output")
if os.path.isdir("/app/audio_output"):
    AUDIO_DIR = "/app/audio_output"


class VoicePersona(BandAgent):

    def __init__(self, brain_id: str = ""):
        super().__init__(handle="voice-persona", token_env_var="BAND_TOKEN_VOICE_PERSONA")
        self._filler_cache: dict[str, str] = {}
        self.brain_id = brain_id
        os.makedirs(AUDIO_DIR, exist_ok=True)

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message.get("content", "")
        if "SPEAK:" in content:
            probe_text = content.split("SPEAK:", 1)[1].strip()
            await self._stream_tts_live(room_id, probe_text)

    async def _stream_tts_live(self, room_id: str, text: str) -> None:
        """Stream TTS audio to frontend in real-time via WebSocket, dual-write to disk for Evidence Portfolio.

        Flow:
        1. Stream chunks from Deepgram, relaying each to frontend as it arrives
        2. Collect all chunks for disk write
        3. After streaming, save complete audio to disk
        4. Always send SPEAK event with audioUrl (fallback + event log)

        Falls back to file-based _speak_probe if no TTS WebSocket is connected.
        """
        if not hasattr(self, 'tts_relay_fn') or not self.tts_relay_fn:
            print("[voice-persona] No TTS relay fn — falling back to HTTP-only")
            return await self._speak_probe(room_id, text)

        chunks: list[bytes] = []
        stream_started = False
        audio_url: str | None = None

        try:
            print(f"[voice-persona] Starting TTS stream: {text[:80]}...")
            async for chunk in stream_tts(
                text, model=TTS_PROBE_MODEL, output_format=TTS_FORMAT,
                api_key=DEEPGRAM_KEY, speed=1.1, encoding="linear16", sample_rate=48000,
            ):
                chunks.append(chunk)
                if not stream_started:
                    await self.tts_relay_fn(
                        room_id,
                        json.dumps({"type": "SPEAK_START", "text": text}),
                        is_binary=False,
                    )
                    stream_started = True
                await self.tts_relay_fn(room_id, chunk, is_binary=True)

            if chunks:
                await self.tts_relay_fn(room_id, json.dumps({"type": "SPEAK_END"}), is_binary=False)

                # Dual-write: save complete audio to disk for Evidence Portfolio
                name = f"{uuid.uuid4().hex}.{TTS_FORMAT}"
                filepath = os.path.join(AUDIO_DIR, name)
                with open(filepath, "wb") as f:
                    for chunk in chunks:
                        f.write(chunk)
                audio_url = f"/audio/{name}"
                print(f"[voice-persona] TTS streamed {len(chunks)} chunks → {audio_url}")
            else:
                print("[voice-persona] TTS returned zero chunks — will send SPEAK event without audioUrl")

        except Exception as e:
            print(f"[voice-persona] TTS streaming failed: {e}")
            if chunks:
                try:
                    name = f"{uuid.uuid4().hex}.{TTS_FORMAT}"
                    filepath = os.path.join(AUDIO_DIR, name)
                    with open(filepath, "wb") as f:
                        for chunk in chunks:
                            f.write(chunk)
                    audio_url = f"/audio/{name}"
                except Exception as write_err:
                    print(f"[voice-persona] Failed to save fallback audio: {write_err}")

        # ALWAYS send SPEAK event (even on failure) so frontend never hangs
        await self.send_event(
            room_id,
            f"SPEAK: {json.dumps({'text': text, 'audioUrl': audio_url or '', 'model': TTS_PROBE_MODEL, 'isFiller': False})}",
        )

    async def _speak_probe(self, room_id: str, text: str) -> None:
        """Fallback: generate TTS, save to file, send SPEAK event with audioUrl."""
        audio_url = await self._generate_tts(text, TTS_PROBE_MODEL)
        if audio_url:
            await self.send_event(room_id, f"SPEAK: {json.dumps({'text': text, 'audioUrl': audio_url, 'model': TTS_PROBE_MODEL, 'isFiller': False})}")

    async def _generate_tts(self, text: str, model: str, filename: str | None = None) -> str | None:
        try:
            chunks = []
            async for chunk in stream_tts(text, model=model, output_format=TTS_FORMAT, api_key=DEEPGRAM_KEY, speed=1.1, encoding="linear16", sample_rate=48000):
                chunks.append(chunk)
            if not chunks:
                return None
            name = filename or f"{uuid.uuid4().hex}.{TTS_FORMAT}"
            filepath = os.path.join(AUDIO_DIR, name)
            with open(filepath, "wb") as f:
                for chunk in chunks:
                    f.write(chunk)
            return f"/audio/{name}"
        except Exception as e:
            print(f"[voice-persona] TTS failed: {e}")
            return None

    async def prefetch_fillers(self) -> None:
        tasks = []
        for i, phrase in enumerate(FILLER_PHRASES):
            fname = f"filler_{i}.{TTS_FORMAT}"
            tasks.append(self._generate_tts(phrase, TTS_FILLER_MODEL, filename=fname))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for phrase, url in zip(FILLER_PHRASES, results):
            if isinstance(url, str):
                self._filler_cache[phrase] = url
        print(f"[voice-persona] Pre-generated {len(self._filler_cache)}/{len(FILLER_PHRASES)} fillers")
