import json
import os
from voicehire.agents.session_brain import SessionBrain
from voicehire.db.operations import db_get_session_history

# Match server.py's AUDIO_DIR logic
_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "audio_output")
if os.path.isdir("/app/audio_output"):
    _AUDIO_DIR = "/app/audio_output"


def _resolve_audio_url(session_id: str, timestamp: float | None) -> str | None:
    """Find audio file for a given session+timestamp and return its URL path."""
    if not timestamp:
        return None
    ts = int(timestamp)
    for ext in ("webm", "wav", "ogg", "mp3"):
        filename = f"{session_id}_{ts}.{ext}"
        if os.path.isfile(os.path.join(_AUDIO_DIR, filename)):
            return f"/audio/{filename}"
    return None


async def generate_report_from_events(session_id: str) -> dict | None:
    """Reconstruct report_json from DB events — no brain dependency."""
    try:
        history = await db_get_session_history(session_id)
        if not history or not history.get("events"):
            print(f"[REPORT] No events found for {session_id}")
            return None

        events = history["events"]
        session_info = history["session"]

        # 1. conversation_history — interleave PROBE + UTTERANCE by timestamp
        conv = sorted(
            [e for e in events if e["event_type"] in ("PROBE", "UTTERANCE")],
            key=lambda e: e.get("timestamp", 0),
        )
        conversation_history = []
        for e in conv:
            ts = e.get("timestamp")
            entry = {
                "type": "probe" if e["event_type"] == "PROBE" else "response",
                "text": e["payload"].get("probeText", e["payload"].get("text", "")),
                "timestamp": ts,
            }
            if e["event_type"] == "UTTERANCE":
                audio_file = e["payload"].get("audio_file")
                if audio_file:
                    entry["audio_url"] = f"/audio/{audio_file}"
                else:
                    audio_url = _resolve_audio_url(session_id, ts)
                    if audio_url:
                        entry["audio_url"] = audio_url
            conversation_history.append(entry)

        # 2. evidence_portfolio
        evidence_portfolio = [
            e["payload"] for e in events if e["event_type"] == "EVIDENCE"
        ]

        # 3. competency_scorecard — aggregate from evidence tags
        scores = {}
        for ev in evidence_portfolio:
            for tag in ev.get("competencies_tagged", []):
                cid = tag.get("competency_id", "unknown")
                s = scores.setdefault(cid, {"confidences": [], "count": 0})
                s["confidences"].append(tag.get("confidence", 0))
                s["count"] += 1

        competency_scorecard = []
        for cid, data in scores.items():
            avg = sum(data["confidences"]) / len(data["confidences"]) if data["confidences"] else 0
            competency_scorecard.append({
                "id": cid,
                "name": cid.replace("_", " ").title(),
                "domain": "technical" if cid in ("coding", "system_design", "ml_pipeline", "d_verification", "i_d__v_e_r_i_f_i_c_a_t_i_o_n") else "behavioral",
                "classification": "MUST_HAVE",
                "status": "COVERED" if avg >= 0.3 else "NOT_COVERED",
                "confidence": round(avg * 100),
                "evidence_count": data["count"],
                "depth_required": "intermediate",
            })

        total = len(competency_scorecard)
        covered = sum(1 for c in competency_scorecard if c["status"] == "COVERED")

        # 4. integrity violations
        integrity_violations = [
            e["payload"] for e in events if e["event_type"] == "INTEGRITY_VIOLATION"
        ]

        # 5. enforcement_config
        enf = session_info.get("enforcement_config", {})
        if isinstance(enf, str):
            enf = json.loads(enf)

        # 6. model_used from deliberation
        model_used = None
        for e in events:
            if e["event_type"] == "DELIBERATION":
                model_used = e["payload"].get("model_used")
                if model_used:
                    break

        report = {
            "competency_scorecard": competency_scorecard,
            "coverage_summary": {
                "total": total,
                "covered": covered,
                "must_have_total": total,
                "must_have_covered": covered,
            },
            "evidence_portfolio": evidence_portfolio[-50:],
            "conversation_history": conversation_history,
            "integrity_violations": integrity_violations,
            "enforcement_config": enf,
            "session_id": session_id,
            "status": "completed",
        }
        if model_used:
            report["model_used"] = model_used

        print(f"[REPORT] Generated report for {session_id}: "
              f"{total} competencies, {len(evidence_portfolio)} evidence items, "
              f"{len(conversation_history)} messages")
        return report

    except Exception as e:
        print(f"[REPORT] Failed to generate from events: {e}")
        import traceback
        traceback.print_exc()
        return None


def generate_report(brain: SessionBrain, session_id: str | None = None) -> dict:
    coverage_map = brain.get_coverage_map(session_id) if session_id else None
    if not coverage_map:
        return {}
    competencies = [
        {
            "id": c.competency_id,
            "name": c.name,
            "domain": c.domain,
            "classification": c.classification,
            "status": c.status,
            "confidence": round(c.confidence * 100),
            "evidence_count": c.evidence_count,
            "depth_required": c.depth_required,
        }
        for c in coverage_map.competencies.values()
    ]
    summary = coverage_map.summary()
    evidence = brain.get_evidence_portfolio(session_id) if session_id else []
    conv = brain.get_conversation_history(session_id) if session_id else []
    return {
        "competency_scorecard": competencies,
        "coverage_summary": {
            "total": summary["total"],
            "covered": summary["covered"],
            "must_have_total": summary["must_have_total"],
            "must_have_covered": summary["must_have_covered"],
        },
        "evidence_portfolio": evidence[-50:],
        "conversation_history": conv,
    }
