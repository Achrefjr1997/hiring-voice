#!/usr/bin/env python3
"""Smoke test — hits all 10 model endpoints. Run after Phase 0.

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

    # AI/ML API models
    aiml_models = [
        ("rubric", "deepseek/deepseek-v4-pro"),
        ("probe", "alibaba/qwen3-32b"),
        ("tech_evidence", "meta-llama/llama-4-scout"),
        ("coverage_update", "Qwen/Qwen2.5-72B-Instruct-Turbo"),
        ("committee", "Qwen/Qwen3-235B-A22B-fp8-tput"),
    ]
    for name, model_id in aiml_models:
        ok, ms = await test_chat(aiml, name, model_id)
        label = f"[OK]" if ok else "[FAIL]"
        print(f"  {label} {name:20s} ({model_id:45s}) {ms:7.0f}ms")
        results.append((name, ok, ms))

    # Featherless models
    feather_models = [
        ("skeptic", "deepseek-ai/DeepSeek-R1"),
        ("behav_evidence", "mistralai/Mistral-7B-Instruct-v0.3"),
    ]
    for name, model_id in feather_models:
        ok, ms = await test_chat(feather, name, model_id)
        label = f"[OK]" if ok else "[FAIL]"
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
