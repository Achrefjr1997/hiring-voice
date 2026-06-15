import os
from openai import AsyncOpenAI
import httpx
from config import AIMLAPI_KEY, FEATHERLESS_KEY, AIMLAPI_BASE_URL, FEATHERLESS_BASE_URL


def _no_proxy_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(proxy=None, timeout=httpx.Timeout(60.0, connect=15.0))


class AIMLAPIClient:
    """AI/ML API client — covers all premium model calls."""

    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=AIMLAPI_BASE_URL,
            api_key=AIMLAPI_KEY,
            http_client=_no_proxy_client(),
        )


class FeatherlessClient:
    """Featherless AI client — flat-rate open-weight inference."""

    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=FEATHERLESS_BASE_URL,
            api_key=FEATHERLESS_KEY,
            http_client=_no_proxy_client(),
        )


MODELS = {
    # AI/ML API
    "rubric":          "deepseek/deepseek-v4-pro",
    "probe":           "alibaba/qwen3-32b",
    "tech_evidence":   "gpt-4o-mini",
    "coverage_update": "Qwen/Qwen2.5-72B-Instruct-Turbo",
    "committee":       "alibaba/qwen3-235b-a22b-thinking-2507",    "tts_probe":       "elevenlabs/eleven_turbo_v2_5",
    "tts_filler":      "openai/tts-1",
    # Featherless AI
    "skeptic":         "deepseek-ai/DeepSeek-R1-0528",
    "behav_evidence":  "mistralai/Mistral-7B-Instruct-v0.3",
}
