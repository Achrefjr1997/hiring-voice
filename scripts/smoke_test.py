#!/usr/bin/env python3
"""Smoke test — hits all model endpoints registered in MODELS dict.

Usage:
    python scripts/smoke_test.py

Uses max_tokens=5 to conserve credits.
Prints [OK] or [FAIL] for each model with latency in ms.
"""

import asyncio
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from voicehire.api.client import AIMLAPIClient, FeatherlessClient, MODELS


AIML_MODEL_NAMES = [
    "rubric", "probe", "tech_evidence", "coverage_update", "committee"
]
FEATHER_MODEL_NAMES = [
    "skeptic", "behav_evidence"
]


async def test_chat(client, name: str, model: str) -> tuple[bool, float]:
    start = time.perf_counter()
    try:
        response = await client.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=5,
        )
        elapsed = (time.perf_counter() - start) * 1000
        ok = bool(response.choices[0].message.content)
        return ok, elapsed
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return False, elapsed


async def main():
    aiml = AIMLAPIClient()
    feather = FeatherlessClient()

    results = []

    for name in AIML_MODEL_NAMES:
        model_id = MODELS.get(name)
        if not model_id:
            print(f"  [SKIP] {name:20s} (not in MODELS dict)")
            continue
        ok, ms = await test_chat(aiml, name, model_id)
        label = "[OK]" if ok else "[FAIL]"
        print(f"  {label} {name:20s} ({model_id:45s}) {ms:7.0f}ms")
        results.append((name, ok, ms))

    for name in FEATHER_MODEL_NAMES:
        model_id = MODELS.get(name)
        if not model_id:
            print(f"  [SKIP] {name:20s} (not in MODELS dict)")
            continue
        ok, ms = await test_chat(feather, name, model_id)
        label = "[OK]" if ok else "[FAIL]"
        print(f"  {label} {name:20s} ({model_id:45s}) {ms:7.0f}ms")
        results.append((name, ok, ms))

    print()
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"Result: {passed}/{total} endpoints passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    print("Smoke test: hitting all model endpoints...\n")
    asyncio.run(main())
