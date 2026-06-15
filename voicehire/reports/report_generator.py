from voicehire.agents.session_brain import SessionBrain


def generate_report(brain: SessionBrain) -> dict:
    map = brain.coverage_map
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
        for c in map.competencies.values()
    ]
    summary = map.summary()
    return {
        "competency_scorecard": competencies,
        "coverage_summary": {
            "total": summary["total"],
            "covered": summary["covered"],
            "must_have_total": summary["must_have_total"],
            "must_have_covered": summary["must_have_covered"],
        },
        "evidence_portfolio": brain.evidence_portfolio[-50:],
        "conversation_history": brain.conversation_history,
    }
