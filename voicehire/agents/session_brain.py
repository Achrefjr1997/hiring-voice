import json
import time
import uuid
from voicehire.band.agent_base import BandAgent
from voicehire.api.client import AIMLAPIClient, MODELS
from voicehire.competency.coverage_map import CoverageMap

PROBE_SYSTEM_PROMPT = """You are a senior staff engineer conducting a technical interview.
You are NOT selecting from a list of questions.
Explore the candidate's understanding of a specific competency based on what they just said.
Output JSON only: {"probeText": "...", "rationale": "...", "expectedSignals": [...]}"""


class SessionBrain(BandAgent):

    def __init__(self, voice_id: str, chain_id: str, committee_id: str):
        super().__init__(
            handle="session-brain",
            token_env_var="BAND_TOKEN_SESSION_BRAIN",
        )
        self.llm = AIMLAPIClient()
        self.coverage_map: CoverageMap | None = None
        self.conversation_history: list[dict] = []
        self.evidence_portfolio: list[dict] = []
        self.current_target = None
        self.exploration_room_id: str | None = None
        self.committee_room_id: str | None = None
        self.foundation_room_id: str | None = None
        self.voice_id = voice_id
        self.chain_id = chain_id
        self.committee_id = committee_id

        self.start_time: float | None = None
        self.max_duration_seconds: int = 30 * 60
        self.probe_counts: dict[str, int] = {}

    def set_duration(self, minutes: int) -> None:
        self.max_duration_seconds = minutes * 60
        print(f"[session-brain] Duration set to {minutes} min ({self.max_duration_seconds}s)")

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message["content"]
        if "COMPETENCY_GRAPH_READY:" in content:
            graph_json = content.split("COMPETENCY_GRAPH_READY:", 1)[1].strip()
            await self._on_graph_ready(room_id, json.loads(graph_json))
        elif "UTTERANCE:" in content:
            transcript = content.split("UTTERANCE:", 1)[1].strip()
            await self._on_utterance(room_id, transcript)
        elif "EVIDENCE:" in content:
            evidence_json = content.split("EVIDENCE:", 1)[1].strip()
            await self._on_evidence(room_id, json.loads(evidence_json))
        elif "CHALLENGE:" in content:
            await self._on_integrity_challenge(room_id, content)
        elif "SESSION_END" in content:
            await self._on_session_end(room_id)

    async def _on_graph_ready(self, room_id: str, graph: dict) -> None:
        if self.coverage_map is not None:
            return
        self.foundation_room_id = room_id
        self.coverage_map = CoverageMap(
            competencies=graph["competencies"],
            skill_implications=graph.get("skill_implications", {}),
        )
        summary = self.coverage_map.summary()
        self.start_time = time.time()
        print(f"[session-brain] CoverageMap seeded: {summary['total']} competencies, "
              f"{summary['must_have_total']} MUST_HAVE")
        await self.send_event(room_id, f"COVERAGE_MAP_INIT: {json.dumps(summary)}")

        room = self.exploration_room_id or room_id
        await self._generate_next_probe(room)

    async def _on_utterance(self, room_id: str, transcript: str) -> None:
        self.conversation_history.append({"role": "candidate", "content": transcript})
        target_ctx = {}
        if self.current_target:
            target_ctx = {
                "competency_id": self.current_target.competency_id,
                "name": self.current_target.name,
                "domain": self.current_target.domain,
                "depth_required": self.current_target.depth_required,
            }
        await self.send_to_agent(room_id, "Evidence Chain", self.chain_id,
            f"EXTRACT: UTTERANCE: {transcript} PROBE: {json.dumps(target_ctx)}")

    async def _on_evidence(self, room_id: str, evidence_node: dict) -> None:
        self.evidence_portfolio.append(evidence_node)
        delta = self.coverage_map.apply_evidence(evidence_node)
        await self.send_event(room_id, f"COVERAGE_MAP_UPDATE: {json.dumps(delta)}")
        if self.committee_room_id:
            await self.send_to_agent(self.committee_room_id, "Hiring Committee",
                                      self.committee_id, f"EVIDENCE: {json.dumps(evidence_node)}")
        await self._generate_next_probe(room_id)

    async def _on_integrity_challenge(self, room_id: str, content: str) -> None:
        try:
            parts = content.split("ADJUSTED_CONFIDENCE:", 1)
            adjustments = json.loads(parts[1].strip())
            delta = self.coverage_map.apply_confidence_adjustment(adjustments)
            await self.send_event(room_id, f"COVERAGE_MAP_UPDATE: {json.dumps(delta)}")
        except Exception as e:
            print(f"[session-brain] Failed to parse challenge: {e}")

    async def _on_session_end(self, room_id: str) -> None:
        if not self.coverage_map:
            return
        summary = self.coverage_map.summary()
        session_summary = {
            "coverageSummary": summary,
            "total_evidence_count": len(self.evidence_portfolio),
            "conversation_turns": len(self.conversation_history),
        }
        if self.committee_room_id:
            await self.send_to_agent(self.committee_room_id, "Hiring Committee",
                                      self.committee_id, f"SESSION_END: {json.dumps(session_summary)}")
        print(f"[session-brain] Session ended. Coverage: {summary}")

    async def _generate_next_probe(self, room_id: str) -> None:
        if not self.coverage_map:
            return

        # 1. TIME LIMIT CHECK — recruiter-controlled hard cutoff
        if self.start_time and (time.time() - self.start_time) > self.max_duration_seconds:
            print(f"[session-brain] TIME_LIMIT_REACHED after {self.max_duration_seconds}s")
            await self.send_event(room_id, "TIME_LIMIT_REACHED: Session duration exceeded.")
            await self._on_session_end(room_id)
            return

        # 2. SELECT NEXT TARGET with dynamic allocation + stuck detection
        target = self.coverage_map.select_next_target()

        while target:
            cid = target.competency_id
            count = self.probe_counts.get(cid, 0)

            # 2a. WEIGHT-BASED CAP — heavier competencies get more questions
            dynamic_max = max(2, round(target.weight * 20))
            if count >= dynamic_max:
                print(f"[session-brain] EXHAUSTED '{target.name}': {count} probes (max {dynamic_max} by weight {target.weight})")
                self.coverage_map.mark_exhausted(cid)
                target = self.coverage_map.select_next_target()
                continue

            # 2b. STUCK DETECTOR — 3+ probes without reaching COVERED
            if count >= 3 and target.status != "COVERED":
                print(f"[session-brain] INSUFFICIENT '{target.name}': {count} probes and still {target.status}")
                self.coverage_map.mark_insufficient(cid)
                target = self.coverage_map.select_next_target()
                continue

            break

        # 3. NO VALID TARGET — interview complete
        if not target:
            print("[session-brain] INTERVIEW_COMPLETE: all targets exhausted or limits reached.")
            await self.send_event(room_id, "INTERVIEW_COMPLETE: All targets resolved or limits reached.")
            await self._on_session_end(room_id)
            return

        # 4. Increment probe count and proceed with generation
        self.probe_counts[target.competency_id] = self.probe_counts.get(target.competency_id, 0) + 1
        self.current_target = target

        probe_context = (
            f"TARGET: {target.name} DOMAIN: {target.domain}\n"
            f"DEPTH: {target.depth_required} COVERAGE: {target.confidence:.0%}\n"
            f"HISTORY: {json.dumps(self.conversation_history[-5:])}"
        )

        response = await self.llm.client.chat.completions.create(
            model=MODELS["probe"],
            messages=[
                {"role": "system", "content": PROBE_SYSTEM_PROMPT},
                {"role": "user",   "content": probe_context},
            ],
            max_tokens=512, temperature=0.7,
            response_format={"type": "json_object"},
        )
        probe = json.loads(response.choices[0].message.content)
        probe["competencyTargeted"] = target.competency_id
        probe["model"] = MODELS["probe"]
        probe["probeId"] = f"probe-{uuid.uuid4().hex[:8]}"

        await self.send_to_agent(room_id, "Voice Persona", self.voice_id,
                                  f"SPEAK: {probe['probeText']}")
        await self.send_event(room_id, f"PROBE_GENERATED: {json.dumps(probe)}")
        self.conversation_history.append({"role": "interviewer", "content": probe["probeText"]})
        print(f"[session-brain] Probe #{self.probe_counts[target.competency_id]} for '{target.name}': {probe['probeText'][:80]}...")
