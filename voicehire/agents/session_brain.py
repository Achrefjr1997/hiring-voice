import json
import time
import uuid
import asyncio
from voicehire.band.agent_base import BandAgent
from voicehire.api.client import AIMLAPIClient, MODELS
from voicehire.competency.coverage_map import CoverageMap
from voicehire.db.operations import ROOM_TO_SESSION, db_insert_event

PROBE_SYSTEM_PROMPT = """You are a senior staff engineer conducting a technical interview.
You are NOT selecting from a list of questions.
Explore the candidate's understanding of a specific competency based on what they just said.
Output JSON only: {"probeText": "...", "rationale": "...", "expectedSignals": [...]}"""

COVERAGE_UPDATE_PROMPT = """You are a rigorous technical assessment auditor.
Review the accumulated evidence for a competency that was challenged by a skeptic.
Decide whether the skeptic's adjusted confidence is justified based on actual evidence.
Output JSON only:
{
  "competencyId": "...",
  "skepticAdjustedConfidence": 0.0-1.0,
  "finalConfidence": 0.0-1.0,
  "justification": "...",
  "overrideReason": null | "EVIDENCE_SUPPORTS_SKEPTIC" | "EVIDENCE_OVERRIDES_SKEPTIC" | "EVIDENCE_INCONCLUSIVE"
}"""


class SessionBrain(BandAgent):

    def __init__(self, voice_id: str, chain_id: str, committee_id: str):
        super().__init__(
            handle="session-brain",
            token_env_var="BAND_TOKEN_SESSION_BRAIN",
        )
        self.llm = AIMLAPIClient()
        self.voice_id = voice_id
        self.chain_id = chain_id
        self.committee_id = committee_id

        self._coverage_maps: dict[str, CoverageMap | None] = {}
        self._conversation_histories: dict[str, list[dict]] = {}
        self._evidence_portfolios: dict[str, list[dict]] = {}
        self._current_targets: dict[str, object | None] = {}
        self._start_times: dict[str, float | None] = {}
        self._max_durations: dict[str, int] = {}
        self._probe_counts: dict[str, dict[str, int]] = {}
        self._candidate_names: dict[str, str | None] = {}
        self._candidate_readys: dict[str, bool] = {}
        self._first_probe_generateds: dict[str, bool] = {}
        self._competency_start_times: dict[str, dict[str, float]] = {}
        self._foundation_room_ids: dict[str, str | None] = {}
        self._exploration_room_ids: dict[str, str | None] = {}
        self._committee_room_ids: dict[str, str | None] = {}

    def _sid(self, room_id: str) -> str:
        return ROOM_TO_SESSION.get(room_id, "")

    def _ensure_session(self, session_id: str) -> None:
        if session_id not in self._coverage_maps:
            self._coverage_maps[session_id] = None
            self._conversation_histories[session_id] = []
            self._evidence_portfolios[session_id] = []
            self._current_targets[session_id] = None
            self._start_times[session_id] = None
            self._max_durations[session_id] = 30 * 60
            self._probe_counts[session_id] = {}
            self._candidate_names[session_id] = None
            self._candidate_readys[session_id] = False
            self._first_probe_generateds[session_id] = False
            self._competency_start_times[session_id] = {}
            self._foundation_room_ids[session_id] = None
            self._exploration_room_ids[session_id] = None
            self._committee_room_ids[session_id] = None

    def init_session(self, session_id: str, foundation_room: str,
                     exploration_room: str, committee_room: str,
                     duration_minutes: int) -> None:
        self._ensure_session(session_id)
        self._foundation_room_ids[session_id] = foundation_room
        self._exploration_room_ids[session_id] = exploration_room
        self._committee_room_ids[session_id] = committee_room
        self._max_durations[session_id] = duration_minutes * 60
        self._coverage_maps[session_id] = None
        self._conversation_histories[session_id] = []
        self._evidence_portfolios[session_id] = []
        self._start_times[session_id] = None
        self._probe_counts[session_id] = {}
        self._current_targets[session_id] = None
        self._candidate_readys[session_id] = False
        self._first_probe_generateds[session_id] = False
        self._competency_start_times[session_id] = {}
        self._candidate_names[session_id] = None
        print(f"[session-brain] Initialized session {session_id[:8]} "
              f"({duration_minutes} min)")

    def get_coverage_map(self, session_id: str) -> CoverageMap | None:
        return self._coverage_maps.get(session_id)

    def get_evidence_portfolio(self, session_id: str) -> list[dict]:
        return self._evidence_portfolios.get(session_id, [])

    def get_conversation_history(self, session_id: str) -> list[dict]:
        return self._conversation_histories.get(session_id, [])

    def get_candidate_name(self, session_id: str) -> str | None:
        return self._candidate_names.get(session_id)

    def set_conversation_audio_url(self, session_id: str, text: str,
                                   audio_url: str) -> None:
        history = self._conversation_histories.get(session_id, [])
        for entry in reversed(history):
            if (entry.get("type") == "probe"
                    and not entry.get("audio_url")
                    and entry.get("text") == text):
                entry["audio_url"] = audio_url
                break

    def set_response_audio_url(self, session_id: str, audio_url: str) -> None:
        history = self._conversation_histories.get(session_id, [])
        for entry in reversed(history):
            if entry.get("type") == "response" and not entry.get("audio_url"):
                entry["audio_url"] = audio_url
                break

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message.get("content", "")
        if "COMPETENCY_GRAPH_READY:" in content:
            graph_json = content.split("COMPETENCY_GRAPH_READY:", 1)[1].strip()
            await self._on_graph_ready(room_id, json.loads(graph_json))
        elif "UTTERANCE:" in content:
            transcript = content.split("UTTERANCE:", 1)[1].strip()
            await self._on_utterance(room_id, transcript)
        elif "CANDIDATE_UTTERANCE:" in content:
            transcript = content.replace("CANDIDATE_UTTERANCE:", "").strip()
            await self._on_utterance(room_id, transcript)
        elif "EVIDENCE:" in content or "EVIDENCE_POSTED:" in content:
            await self._on_evidence(room_id, content)
        elif "CHALLENGE:" in content:
            await self._on_integrity_challenge(room_id, content)
        elif "CANDIDATE_IDENTIFIED:" in content:
            sid = self._sid(room_id)
            data = json.loads(content.split("CANDIDATE_IDENTIFIED:", 1)[1].strip())
            self._candidate_names[sid] = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
            self._candidate_readys[sid] = True
            print(f"[session-brain] Candidate identified: {self._candidate_names[sid]}. Waiting for WS connection...")
        elif "CANDIDATE_CONNECTED" in content:
            sid = self._sid(room_id)
            print("[session-brain] Candidate WebSocket connected. Generating first probe.")
            if (self._candidate_readys.get(sid, False)
                    and not self._first_probe_generateds.get(sid, False)
                    and self._coverage_maps.get(sid)):
                self._first_probe_generateds[sid] = True
                await self._generate_next_probe(room_id)
        elif "SESSION_END" in content:
            await self._on_session_end(room_id)

    async def _on_graph_ready(self, room_id: str, graph: dict) -> None:
        sid = self._sid(room_id)
        if self._coverage_maps.get(sid) is not None:
            return
        self._foundation_room_ids[sid] = room_id
        self._coverage_maps[sid] = CoverageMap(
            competencies=graph["competencies"],
            skill_implications=graph.get("skill_implications", {}),
        )
        summary = self._coverage_maps[sid].summary()
        self._start_times[sid] = time.time()
        print(f"[session-brain] CoverageMap seeded: {summary['total']} competencies, "
              f"{summary['must_have_total']} MUST_HAVE. Waiting for candidate to connect...")
        await self.send_event(room_id, f"COVERAGE_MAP_INIT: {json.dumps(summary)}")

    async def _on_utterance(self, room_id: str, transcript: str) -> None:
        sid = self._sid(room_id)
        self._conversation_histories[sid].append({
            "type": "response",
            "role": "candidate",
            "content": transcript,
            "text": transcript,
            "timestamp": time.time(),
            "audio_url": None,
        })
        target = self._current_targets.get(sid)
        target_ctx = {}
        if target:
            target_ctx = {
                "competency_id": target.competency_id,
                "name": target.name,
                "domain": target.domain,
                "depth_required": target.depth_required,
            }
        await self.send_to_agent(room_id, "Evidence Chain", self.chain_id,
            f"EXTRACT: UTTERANCE: {transcript}\n---PROBE---\n{json.dumps(target_ctx)}")

    async def _on_evidence(self, room_id: str, content: str) -> None:
        sid = self._sid(room_id)
        try:
            evidence_json = content.split("EVIDENCE:", 1)[1] if "EVIDENCE:" in content else content.split("EVIDENCE_POSTED:", 1)[1]
            evidence_node = json.loads(evidence_json)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"[session-brain] Failed to parse EVIDENCE event: {e}")
            return
        self._evidence_portfolios[sid].append(evidence_node)
        cmap = self._coverage_maps.get(sid)
        if cmap:
            delta = cmap.apply_evidence(evidence_node)
            await self.send_event(room_id, f"COVERAGE_MAP_UPDATE: {json.dumps(delta)}")
        committee_room = self._committee_room_ids.get(sid)
        if committee_room:
            await self.send_to_agent(committee_room, "Hiring Committee",
                                      self.committee_id, f"EVIDENCE: {json.dumps(evidence_node)}")
        if sid:
            asyncio.create_task(db_insert_event(sid, "EVIDENCE", evidence_node))
        await self._generate_next_probe(room_id)

    async def _on_integrity_challenge(self, room_id: str, content: str) -> None:
        sid = self._sid(room_id)
        try:
            parts = content.split("ADJUSTED_CONFIDENCE:", 1)
            adjustments = json.loads(parts[1].strip())
            cmap = self._coverage_maps.get(sid)
            if not cmap:
                return

            challenge_reason = parts[0].replace("CHALLENGE:", "").strip() if "CHALLENGE:" in parts[0] else ""

            for cid, adjusted_conf in adjustments.items():
                competency = cmap.competencies.get(cid)
                if not competency:
                    continue

                relevant_evidence = [
                    ev for ev in self._evidence_portfolios.get(sid, [])
                    if cid in [t.get("competency_id", "") for t in ev.get("competencies_tagged", [])]
                ]
                eval_input = {
                    "competencyId": cid,
                    "competencyName": competency.name,
                    "currentConfidence": competency.confidence,
                    "skepticAdjustedConfidence": adjusted_conf,
                    "challengeReason": challenge_reason,
                    "evidenceCount": len(relevant_evidence),
                    "evidence": relevant_evidence[-3:],
                }

                try:
                    r = await self.llm.client.chat.completions.create(
                        model=MODELS["coverage_update"],
                        messages=[
                            {"role": "system", "content": COVERAGE_UPDATE_PROMPT},
                            {"role": "user", "content": json.dumps(eval_input)},
                        ],
                        max_tokens=512, temperature=0.2,
                        response_format={"type": "json_object"},
                    )
                    result = json.loads(r.choices[0].message.content)
                    final_conf = result.get("final_confidence", adjusted_conf)
                except Exception as e:
                    print(f"[session-brain] coverage_update LLM failed, falling back to deterministic: {e}")
                    final_conf = adjusted_conf

                final_conf = max(0.0, min(1.0, final_conf))
                adjustments[cid] = final_conf

            delta = cmap.apply_confidence_adjustment(adjustments)
            await self.send_event(room_id, f"COVERAGE_MAP_UPDATE: {json.dumps(delta)}")
        except Exception as e:
            print(f"[session-brain] Failed to parse challenge: {e}")

    async def _on_session_end(self, room_id: str) -> None:
        sid = self._sid(room_id)
        cmap = self._coverage_maps.get(sid)
        if not cmap:
            return
        summary = cmap.summary()
        session_summary = {
            "coverageSummary": summary,
            "total_evidence_count": len(self._evidence_portfolios.get(sid, [])),
            "conversation_turns": len(self._conversation_histories.get(sid, [])),
        }
        committee_room = self._committee_room_ids.get(sid)
        if committee_room:
            await self.send_to_agent(committee_room, "Hiring Committee",
                                      self.committee_id, f"SESSION_END: {json.dumps(session_summary)}")
        print(f"[session-brain] Session ended. Coverage: {summary}")

    async def _generate_next_probe(self, room_id: str) -> None:
        sid = self._sid(room_id)
        cmap = self._coverage_maps.get(sid)
        if not cmap:
            return

        if not self._candidate_readys.get(sid, False):
            print("[session-brain] Candidate not ready yet. Waiting...")
            return

        start_time = self._start_times.get(sid)
        max_dur = self._max_durations.get(sid, 30 * 60)

        if start_time and (time.time() - start_time) > max_dur:
            print(f"[session-brain] TIME_LIMIT_REACHED after {max_dur}s")
            await self.send_event(room_id, "TIME_LIMIT_REACHED: Session duration exceeded.")
            await self._on_session_end(room_id)
            return

        target = cmap.select_next_target()
        probe_counts = self._probe_counts.setdefault(sid, {})
        comp_start_times = self._competency_start_times.setdefault(sid, {})
        max_comp_dur = 10 * 60
        max_q_per_comp = 3

        while target:
            cid = target.competency_id
            count = probe_counts.get(cid, 0)

            if cid not in comp_start_times:
                comp_start_times[cid] = time.time()

            elapsed = time.time() - comp_start_times[cid]
            if elapsed > max_comp_dur:
                print(f"[session-brain] TIME_LIMIT for '{target.name}': {elapsed:.0f}s > {max_comp_dur}s")
                cmap.mark_exhausted(cid)
                target = cmap.select_next_target()
                continue

            if count >= max_q_per_comp:
                print(f"[session-brain] QUESTION_LIMIT for '{target.name}': {count} >= {max_q_per_comp}")
                cmap.mark_exhausted(cid)
                target = cmap.select_next_target()
                continue

            dynamic_max = max(2, round(target.weight * 20))
            if count >= dynamic_max:
                print(f"[session-brain] EXHAUSTED '{target.name}': {count} probes (max {dynamic_max} by weight {target.weight})")
                cmap.mark_exhausted(cid)
                target = cmap.select_next_target()
                continue

            if count >= 3 and target.status != "COVERED":
                print(f"[session-brain] INSUFFICIENT '{target.name}': {count} probes and still {target.status}")
                cmap.mark_insufficient(cid)
                target = cmap.select_next_target()
                continue

            break

        if not target:
            print("[session-brain] INTERVIEW_COMPLETE: all targets exhausted or limits reached.")
            await self.send_event(room_id, "INTERVIEW_COMPLETE: All targets resolved or limits reached.")
            await asyncio.sleep(5)
            await self._on_session_end(room_id)
            await self.send_event(room_id, "SESSION_END: complete")
            return

        probe_counts[target.competency_id] = probe_counts.get(target.competency_id, 0) + 1
        self._current_targets[sid] = target
        elapsed = time.time() - comp_start_times.get(target.competency_id, time.time())
        print(f"[session-brain] Probe #{probe_counts[target.competency_id]} for '{target.name}' (time: {elapsed:.0f}s / {max_comp_dur}s)")

        conv_history = self._conversation_histories.get(sid, [])
        probe_context = (
            f"TARGET: {target.name} DOMAIN: {target.domain}\n"
            f"DEPTH: {target.depth_required} COVERAGE: {target.confidence:.0%}\n"
            f"HISTORY: {json.dumps(conv_history[-5:])}"
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
        conv_history.append({
            "type": "probe",
            "timestamp": time.time(),
            "competency_id": target.competency_id,
            "competency_name": target.name,
            "text": probe["probeText"],
            "audio_url": None,
        })
        if sid:
            asyncio.create_task(db_insert_event(sid, "PROBE", probe))
        print(f"[session-brain] Probe #{probe_counts[target.competency_id]} for '{target.name}': {probe['probeText'][:80]}...")
