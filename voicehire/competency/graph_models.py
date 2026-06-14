from dataclasses import dataclass, field
from typing import Literal


@dataclass
class CompetencyNode:
    competency_id: str
    name: str
    domain: str
    classification: Literal["MUST_HAVE", "NICE_TO_HAVE"]
    depth_required: Literal["surface", "applied", "expert"]
    min_evidence_count: int
    min_confidence: float
    weight: float


@dataclass
class CompetencyGraph:
    competencies: list[CompetencyNode]
    domain_weights: dict[str, float]
    skill_implications: dict[str, dict[str, float]]
    session_id: str
    role_level: str


@dataclass
class EvidenceNode:
    evidence_id: str
    probe_id: str | None
    raw_transcript: str
    source_type: str
    competencies_tagged: list[dict]
    behavioral_tags: list[dict]
    extracted_signals: list[str]
    demonstrated_skills: list[str]
    missed_signals: list[str]
    claims_confirmed: list[str]
    claims_contradicted: list[str]
    ownership_score: float
    overall_confidence: float


@dataclass
class Probe:
    probe_id: str
    probe_text: str
    rationale: str
    expected_signals: list[str]
    competency_targeted: str
    model: str


@dataclass
class CompetencyVerdict:
    competency_id: str
    verdict: Literal["DEMONSTRATED", "WEAK", "NOT_DEMONSTRATED", "EVIDENCE_INSUFFICIENT"]
    key_evidence_ids: list[str]
    depth_reached: str
    integrity_flagged: bool


@dataclass
class DeliberationTranscript:
    advocate: str
    critic: str


@dataclass
class HiringDecision:
    session_id: str
    final_recommendation: Literal["STRONG_HIRE", "HIRE", "NO_HIRE", "STRONG_NO_HIRE"]
    competency_verdicts: dict[str, CompetencyVerdict]
    evidence_gaps: list[str]
    must_have_total: int
    must_have_demonstrated: int
    consensus_reached: bool
    deliberation_transcript: DeliberationTranscript
    model_used: str
