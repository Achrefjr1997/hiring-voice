import pytest
from voicehire.competency.coverage_map import CoverageMap, CompetencyState


def _make_competency(cid, name, classification="MUST_HAVE", weight=0.5,
                     status="UNEXPLORED", confidence=0.0, evidence_count=0):
    return {
        "competency_id": cid,
        "name": name,
        "domain": "backend",
        "classification": classification,
        "depth_required": "applied",
        "min_evidence_count": 2,
        "min_confidence": 0.6,
        "weight": weight,
        "status": status,
        "confidence": confidence,
        "evidence_count": evidence_count,
    }


def test_all_unexplored():
    """3 MUST_HAVEs with weights 0.5, 0.3, 0.2 — returns highest-weight."""
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", weight=0.5),
            _make_competency("c2", "System Design", weight=0.3),
            _make_competency("c3", "Testing", weight=0.2),
        ],
        skill_implications={},
    )
    target = cm.select_next_target()
    assert target is not None
    assert target.competency_id == "c1"
    assert target.weight == 0.5


def test_one_weak_rest_unexplored():
    """2 MUST_HAVEs: one WEAK, one UNEXPLORED — UNEXPLORED wins (1.5x multiplier)."""
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", weight=0.5, status="WEAK", confidence=0.3, evidence_count=1),
            _make_competency("c2", "System Design", weight=0.4),
        ],
        skill_implications={},
    )
    target = cm.select_next_target()
    assert target is not None
    assert target.competency_id == "c2"


def test_all_covered():
    """2 MUST_HAVEs: both COVERED — returns None."""
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", status="COVERED", confidence=0.9, evidence_count=3),
            _make_competency("c2", "System Design", status="COVERED", confidence=0.8, evidence_count=2),
        ],
        skill_implications={},
    )
    assert cm.select_next_target() is None


def test_must_have_beats_nice_to_have():
    """1 UNEXPLORED MUST_HAVE vs 1 UNEXPLORED NICE_TO_HAVE at same weight."""
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", classification="MUST_HAVE", weight=0.3),
            _make_competency("c2", "Nice-to-have Skill", classification="NICE_TO_HAVE", weight=0.3),
        ],
        skill_implications={},
    )
    target = cm.select_next_target()
    assert target is not None
    assert target.competency_id == "c1"


def test_empty_competencies():
    """No competencies — returns None."""
    cm = CoverageMap(competencies=[], skill_implications={})
    assert cm.select_next_target() is None


def test_apply_evidence_snake_case():
    """apply_evidence reads snake_case keys from evidence node."""
    cm = CoverageMap(
        competencies=[_make_competency("c1", "Async Python", weight=0.5)],
        skill_implications={"asyncio": {"c1": 0.3}},
    )
    evidence = {
        "evidence_id": "ev-001",
        "raw_transcript": "I use asyncio daily with Python 3.13",
        "source_type": "VERBAL_RESPONSE",
        "competencies_tagged": [
            {"competency_id": "c1", "confidence": 0.85, "polarity": "POSITIVE"},
        ],
        "demonstrated_skills": ["asyncio"],
        "overall_confidence": 0.85,
        "extracted_signals": ["uses asyncio", "Python 3.13"],
        "behavioral_tags": [],
        "ownership_score": 0.9,
    }

    delta = cm.apply_evidence(evidence)

    c = cm.competencies["c1"]
    assert c.status == "WEAK"
    assert c.confidence > 0.3
    assert c.evidence_count == 1
    assert c.evidence_ids == ["ev-001"]
    assert "c1" in delta
    assert delta["c1"]["new_status"] == "WEAK"
    assert delta["c1"]["new_confidence"] > 0.3
    assert delta["c1"]["inferred"] is True
    # Skill implication inference bumped confidence via demonstrated_skills
    assert c.confidence > 0.5


def test_mark_exhausted_removes_from_selection():
    cm = CoverageMap(
        competencies=[_make_competency("c1", "Async Python", weight=0.5)],
        skill_implications={},
    )
    cm.mark_exhausted("c1")
    assert cm.select_next_target() is None
    assert cm.competencies["c1"].status == "EXHAUSTED"


def test_mark_insufficient_removes_from_selection():
    cm = CoverageMap(
        competencies=[_make_competency("c1", "Async Python", weight=0.5)],
        skill_implications={},
    )
    cm.mark_insufficient("c1")
    assert cm.select_next_target() is None
    assert cm.competencies["c1"].status == "INSUFFICIENT"


def test_exhausted_falls_through_to_next_competency():
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", weight=0.5),
            _make_competency("c2", "System Design", weight=0.3),
        ],
        skill_implications={},
    )
    cm.mark_exhausted("c1")
    target = cm.select_next_target()
    assert target is not None
    assert target.competency_id == "c2"


def test_all_terminal_returns_none():
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", weight=0.5),
            _make_competency("c2", "System Design", weight=0.3),
            _make_competency("c3", "Testing", weight=0.2),
        ],
        skill_implications={},
    )
    cm.mark_exhausted("c1")
    cm.mark_insufficient("c2")
    cm.mark_exhausted("c3")
    assert cm.select_next_target() is None


def test_covered_still_blocks_after_terminal_additions():
    """Existing COVERED logic still works alongside new terminal states."""
    cm = CoverageMap(
        competencies=[
            _make_competency("c1", "Async Python", status="COVERED", confidence=0.9, evidence_count=3),
            _make_competency("c2", "System Design", weight=0.3),
        ],
        skill_implications={},
    )
    cm.mark_exhausted("c2")
    assert cm.select_next_target() is None
