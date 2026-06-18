import httpx
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import BAND_API_KEY, BAND_API_BASE, BAND_AUTH_HEADER

AGENTS = [
    {"name": "Session Brain",           "description": "LangGraph interview orchestrator"},
    {"name": "Rubric Synthesizer",       "description": "CompetencyGraph generator"},
    {"name": "Voice Persona",            "description": "STT + TTS pipeline"},
    {"name": "Evidence Chain",           "description": "LCEL evidence extractor"},
    {"name": "Integrity Skeptic",        "description": "DeepSeek R1 challenge agent"},
    {"name": "Hiring Committee",         "description": "AutoGen 3-agent deliberation"},
]

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def name_to_env_key(name: str) -> str:
    return f"BAND_TOKEN_{name.upper().replace(' ', '_')}"


def name_to_handle(name: str) -> str:
    return name.lower().replace(" ", "-")


def register_agents():
    headers = {BAND_AUTH_HEADER: BAND_API_KEY, "Content-Type": "application/json"}
    client = httpx.Client(base_url=BAND_API_BASE, headers=headers)

    print("Registering 6 agents on Band platform...\n")

    existing = client.get("/me/agents").json()
    existing_names = {a["name"] for a in existing.get("data", [])}

    token_lines = []
    all_ok = True
    for agent in AGENTS:
        if agent["name"] in existing_names:
            print(f"  [SKIP] @{name_to_handle(agent['name'])} ({agent['name']}) — already registered")
            continue

        r = client.post("/me/agents/register", json={"agent": agent})
        handle = name_to_handle(agent["name"])
        status = "OK" if r.is_success else "FAIL"
        print(f"  [{status}] @{handle} => {r.status_code}")
        if not r.is_success:
            print(f"           {r.text[:200]}")
            all_ok = False
            continue

        data = r.json().get("data", {})
        credentials = data.get("credentials", {})
        token = credentials.get("api_key")
        if token:
            env_key = name_to_env_key(agent["name"])
            token_lines.append(f"{env_key}={token}")
            print(f"           => {env_key} saved")
        else:
            print(f"           => WARNING: no api_key in response: {data}")
            all_ok = False

    if token_lines:
        print("\n--- Append these to .env ---")
        for line in token_lines:
            print(line)

        write = input("\nWrite to .env? (y/N): ").strip().lower()
        if write == "y":
            with open(ENV_PATH, "a", encoding="utf-8") as f:
                f.write("\n" + "\n".join(token_lines) + "\n")
            print("Done! Tokens appended to .env")
        else:
            print("Skipped. Manually add the lines above to .env")
    else:
        print("\nNo new tokens to add.")

    if not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    register_agents()
