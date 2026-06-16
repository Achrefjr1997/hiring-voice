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
        content = message["content"]
        if "SPEAK:" in content:
            probe_text = content.split("SPEAK:", 1)[1].strip()
            await self._speak_probe(room_id, probe_text)

    async def _speak_probe(self, room_id: str, text: str) -> None:
        audio_url = await self._generate_tts(text, TTS_PROBE_MODEL)
        if audio_url:
            await self.send_event(room_id, f"SPEAK: {json.dumps({'text': text, 'audioUrl': audio_url, 'model': TTS_PROBE_MODEL, 'isFiller': False})}")

    async def _generate_tts(self, text: str, model: str, filename: str | None = None) -> str | None:
        try:
            chunks = []
            async for chunk in stream_tts(text, model=model, output_format=TTS_FORMAT, api_key=DEEPGRAM_KEY):
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
