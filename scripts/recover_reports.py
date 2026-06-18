import asyncio
from voicehire.db.operations import db_end_session
from voicehire.reports.report_generator import generate_report_from_events


async def recover(session_id: str) -> bool:
    print(f"[RECOVER] Processing {session_id}...")
    report = await generate_report_from_events(session_id)
    if not report:
        print(f"[RECOVER] {session_id}: no report generated")
        return False
    try:
        await db_end_session(session_id, report)
        msgs = len(report.get("conversation_history", []))
        evs = len(report.get("evidence_portfolio", []))
        comps = len(report.get("competency_scorecard", []))
        print(f"[RECOVER] {session_id}: report saved "
              f"({msgs} msgs, {evs} evidence, {comps} competencies)")
        return True
    except Exception as e:
        print(f"[RECOVER] {session_id}: db_end_session failed: {e}")
        return False


async def main():
    targets = ["c6042318", "8291f0eb", "95f9bff3"]
    print(f"Recovering {len(targets)} sessions...")
    ok = 0
    for sid in targets:
        if await recover(sid):
            ok += 1
    print(f"\nRESULT: {ok}/{len(targets)} sessions recovered")


if __name__ == "__main__":
    asyncio.run(main())
