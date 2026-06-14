import os
from dotenv import load_dotenv

load_dotenv()

AIMLAPI_KEY = os.environ["AIMLAPI_KEY"]
FEATHERLESS_KEY = os.environ["FEATHERLESS_KEY"]
BAND_API_KEY = os.environ["BRANDAPIKEY"]

AIMLAPI_BASE_URL = "https://api.aimlapi.com/v1"
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
BAND_API_BASE = "https://app.band.ai/api/v1"
BAND_WS_URL = "wss://app.band.ai/api/v1/socket/websocket"
BAND_AUTH_HEADER = "X-API-Key"

DEEPGRAM_KEY = os.environ.get("DEEPGRAM_KEY", "")
DEEPGRAM_STT_MODEL = "nova-2"
DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"
TTS_FILLER_MODEL = "aura-2-thalia-en"
TTS_PROBE_MODEL = "aura-2-apollo-en"
TTS_FORMAT = "mp3"
