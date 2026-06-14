from dataclasses import dataclass, field
from typing import Literal


@dataclass
class CompetencyState:
    competency_id: str
    name: str
    domain: str
    classification: Literal["MUST_HAVE", "NICE_TO_HAVE"]
    depth_required: Literal["surface", "applied", "expert"]
    min_evidence_count: int
    min_confidence: float
    weight: float
    status: Literal["UNEXPLORED", "WEAK", "COVERED", "INSUFFICIENT", "EXHAUSTED"] = "UNEXPLORED"
    confidence: float = 0.0
    evidence_count: int = 0
    evidence_ids: list = field(default_factory=list)


class CoverageMap:
    """Deterministic coverage tracking. No LLM. No graph DB."""

    def __init__(self, competencies: list[dict], skill_implications: dict[str, dict]):
        self.competencies: dict[str, CompetencyState] = {
            c["competency_id"]: CompetencyState(**{k: v for k, v in c.items()
                                                    if k in CompetencyState.__dataclass_fields__})
            for c in competencies
        }
        self.skill_implications = skill_implications

    def apply_evidence(self, evidence_node: dict) -> dict:
        delta = {}
        for tag in evidence_node.get("competencies_tagged", []):
            cid = tag["competency_id"]
            if cid not in self.competencies:
                continue
            c = self.competencies[cid]
            contribution = tag["confidence"] * {
                "POSITIVE": 1.0, "NEUTRAL": 0.3, "NEGATIVE": -0.4
            }.get(tag["polarity"], 0)
            prev_conf, prev_status = c.confidence, c.status
            c.confidence = max(0.0, min(1.0,
                (c.confidence * c.evidence_count + contribution) / (c.evidence_count + 1)
            ))
            c.evidence_count += 1
            c.evidence_ids.append(evidence_node["evidence_id"])
            if c.evidence_count >= c.min_evidence_count and c.confidence >= c.min_confidence:
                c.status = "COVERED"
            elif c.evidence_count > 0:
                c.status = "WEAK"
            delta[cid] = {
                "prev_confidence": prev_conf, "new_confidence": c.confidence,
                "prev_status": prev_status,   "new_status": c.status,
                "evidence_count": c.evidence_count,
            }

        for skill_id, implications in self.skill_implications.items():
            if skill_id in evidence_node.get("demonstrated_skills", []):
                for implied_cid, weight in implications.items():
                    if implied_cid in self.competencies:
                        c = self.competencies[implied_cid]
                        c.confidence = min(1.0,
                            c.confidence + evidence_node.get("overall_confidence", 0.5) * weight * 0.3
                        )
                        if c.status == "UNEXPLORED" and c.confidence > 0.15:
                            c.status = "WEAK"
                        entry = delta.get(implied_cid, {})
                        entry.update({"inferred": True, "new_confidence": c.confidence})
                        delta[implied_cid] = entry

        return delta

    def apply_confidence_adjustment(self, adjustments: dict[str, float]) -> dict:
        delta = {}
        for cid, adjusted_conf in adjustments.items():
            if cid not in self.competencies:
                continue
            c = self.competencies[cid]
            prev_conf, prev_status = c.confidence, c.status
            c.confidence = max(0.0, min(1.0, adjusted_conf))
            if c.confidence < c.min_confidence:
                c.status = "WEAK" if c.evidence_count > 0 else "UNEXPLORED"
            delta[cid] = {
                "prev_confidence": prev_conf, "new_confidence": c.confidence,
                "prev_status": prev_status,   "new_status": c.status,
                "evidence_count": c.evidence_count, "skeptic_adjusted": True,
            }
        return delta

    def mark_exhausted(self, cid: str) -> None:
        if cid in self.competencies:
            self.competencies[cid].status = "EXHAUSTED"

    def mark_insufficient(self, cid: str) -> None:
        if cid in self.competencies:
            self.competencies[cid].status = "INSUFFICIENT"

    def select_next_target(self) -> CompetencyState | None:
        candidates = []
        for c in self.competencies.values():
            if c.status in ("COVERED", "EXHAUSTED", "INSUFFICIENT"):
                continue
            if c.classification == "MUST_HAVE":
                priority = c.weight * (1.5 if c.status == "UNEXPLORED" else (1.0 - c.confidence))
                candidates.append((priority, c))
            elif c.classification == "NICE_TO_HAVE" and c.status == "UNEXPLORED":
                candidates.append((c.weight * 0.5, c))
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]

    def summary(self) -> dict:
        covered = sum(1 for c in self.competencies.values() if c.status == "COVERED")
        must_have = [c for c in self.competencies.values() if c.classification == "MUST_HAVE"]
        must_have_covered = sum(1 for c in must_have if c.status == "COVERED")
        return {
            "total": len(self.competencies),
            "covered": covered,
            "must_have_total": len(must_have),
            "must_have_covered": must_have_covered,
            "all_must_haves_done": must_have_covered == len(must_have),
        }
