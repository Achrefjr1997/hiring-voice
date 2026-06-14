import httpx
from config import DEEPGRAM_KEY, DEEPGRAM_STT_MODEL


async def transcribe(audio_bytes: bytes, mime: str = "audio/webm") -> str:
    url = f"https://api.deepgram.com/v1/listen?model={DEEPGRAM_STT_MODEL}&smart_format=true"
    headers = {
        "Authorization": f"Token {DEEPGRAM_KEY}",
        "Content-Type": mime,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, content=audio_bytes, headers=headers)
        response.raise_for_status()
    data = response.json()
    try:
        return data["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError, TypeError):
        print(f"[stt] Unexpected Deepgram response shape: {data}")
        return ""
