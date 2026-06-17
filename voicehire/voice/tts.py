import httpx
from config import DEEPGRAM_KEY, DEEPGRAM_TTS_URL


async def stream_tts(
    text: str,
    model: str = "aura-2-thalia-en",
    output_format: str = "mp3",
    api_key: str = DEEPGRAM_KEY,
    **kwargs,
):
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "text/plain",
        "Accept": f"audio/{output_format}",
    }
    params = {"model": model, **kwargs}
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            DEEPGRAM_TTS_URL,
            params=params,
            content=text,
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(chunk_size=8192):
                if chunk:
                    yield chunk
