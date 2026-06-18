"""
Standalone test for Hiring Committee's COMMITTEE_DECISION message.
Skips the entire interview and directly tests the committee deliberation.

Usage: python scripts/test_committee_standalone.py
Cost: ~$0.05 per run (3 LLM calls for Advocate/Critic/Chair)
"""

import asyncio
import json
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from voicehire.agents.hiring_committee import HiringCommittee
from voicehire.band.session_factory import BandSessionFactory

MOCK_EVIDENCE = [
    {
        "evidence_id": f"ev-test-{i}",
        "probe_id": "",
        "raw_transcript": f"Sample response {i}",
        "source_type": "VERBAL_RESPONSE",
        "competencies_tagged": [{"competency_id": "test_comp", "confidence": 0.7, "polarity": "POSITIVE"}],
        "behavioral_tags": [],
        "extracted_signals": ["test signal"],
        "demonstrated_skills": ["test skill"],
        "missed_signals": [],
        "claims_confirmed": [],
        "claims_contradicted": [],
        "ownership_score": 0.5,
        "overall_confidence": 0.7,
    }
    for i in range(24)
]

MOCK_PORTFOLIO = {
    "nodes": MOCK_EVIDENCE,
    "coverageSummary": {
        "total": 10,
        "covered": 3,
        "must_have_total": 7,
        "must_have_covered": 2,
        "all_must_haves_done": False,
    },
}


async def main():
    print("=" * 80)
    print("STANDALONE COMMITTEE TEST")
    print("=" * 80)
    print()
    print("This test will:")
    print("1. Create a temporary Band room")
    print("2. Populate the committee's evidence memory")
    print("3. Call Hiring Committee's _deliberate() directly")
    print("4. Verify COMMITTEE_DECISION message is sent without 422")
    print()
    print("Estimated cost: ~$0.05 (3 LLM calls)")
    print()
    print("   (auto-continuing in 2 seconds...)")
    await asyncio.sleep(2)
    print()

    factory = BandSessionFactory()
    committee = HiringCommittee(brain_id="")

    # Create a temporary test room
    print("[1/4] Creating temporary test room...")
    session_id = "test-committee-standalone"
    band_session = await asyncio.to_thread(factory.create_session, session_id)
    committee_room_id = band_session.committee_room_id
    print(f"      Room created: {committee_room_id}")
    print()

    # Populate committee's in-memory evidence (same as during real session)
    print("[2/4] Populating committee's evidence memory (24 nodes)...")
    for i, evidence in enumerate(MOCK_EVIDENCE):
        committee._evidence_nodes.append(evidence)
    print(f"      {len(committee._evidence_nodes)} evidence nodes loaded")
    print()

    # Call _deliberate() directly
    print("[3/4] Calling Hiring Committee's _deliberate() method...")
    print("      Making 3 LLM calls (Advocate, Critic, Chair)")
    print("      Estimated time: 30-90 seconds")
    print()

    try:
        await committee._deliberate(committee_room_id, MOCK_PORTFOLIO)
        print()
        print("[4/4] COMMITTEE_DECISION sent. Check diagnostic log above for:")
        print("      - Total message size (should be under 4000 chars)")
        print("      - Advocate length (should be truncated to ~300)")
        print("      - Critic length (should be truncated to ~300)")
        print()
        print(f"Room URL: https://app.band.ai/chats/{committee_room_id}")
    except Exception as e:
        print()
        print("[4/4] FAILED!")
        print(f"      Error: {e}")
        print()
        print("The diagnostic log above shows the exact message size and error body.")
        raise

    print()
    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    print()


if __name__ == "__main__":
    asyncio.run(main())
