import asyncio
import json
import time
import uuid
from voicehire.api.client import AIMLAPIClient, FeatherlessClient, MODELS
from voicehire.band.agent_base import BandAgent
from voicehire.util import normalize_keys

TECH_EVIDENCE_PROMPT = """Extract technical signals from a candidate's verbal response.
Return JSON only:
{
  "competencyTags": [{"competencyId": "...", "confidence": 0.0-1.0, "polarity": "POSITIVE"|"NEUTRAL"|"NEGATIVE"}],
  "signals": ["..."],
  "demonstratedSkills": ["..."],
  "missedSignals": ["..."],
  "claimsConfirmed": ["..."],
  "claimsContradicted": ["..."]
}"""

BEHAV_EVIDENCE_PROMPT = """Extract behavioral signals from a candidate's verbal response.
Analyze: ownership language, collaboration, ambiguity handling, communication quality.
Return JSON only:
{
  "behavioralTags": [{"tag": "...", "confidence": 0.0-1.0, "polarity": "POSITIVE"|"NEUTRAL"|"NEGATIVE"}],
  "ownershipScore": 0.0-1.0,
  "collaborationScore": 0.0-1.0,
  "communicationScore": 0.0-1.0,
  "redFlags": []
}"""


class EvidenceChain(BandAgent):

    def __init__(self, brain_id: str, skeptic_id: str):
        super().__init__(
            handle="evidence-chain",
            token_env_var="BAND_TOKEN_EVIDENCE_CHAIN",
        )
        self.aiml = AIMLAPIClient()
        self.feather = FeatherlessClient()
        self.brain_id = brain_id
        self.skeptic_id = skeptic_id

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message["content"]
        if "EXTRACT:" not in content:
            return
        parts = content.split("EXTRACT:", 1)[1]
        utterance = self._extract_section(parts, "UTTERANCE:")
        probe_raw = self._extract_section(parts, "PROBE:")
        probe_ctx = json.loads(probe_raw) if probe_raw else {}

        evidence_node = await self.extract(utterance, probe_ctx)

        ev_json = json.dumps(evidence_node)
        await self.send_to_agent(room_id, "Session Brain", self.brain_id,
                                  f"EVIDENCE: {ev_json}")
        await self.send_to_agent(room_id, "Integrity Skeptic", self.skeptic_id,
                                  f"EVALUATE: {ev_json}")
        print(f"[evidence-chain] Posted EVIDENCE ({len(ev_json)} chars)")

    async def extract(self, utterance: str, probe_context: dict) -> dict:
        ctx = {
            "utterance": utterance,
            "probeAsked": probe_context.get("probeText", probe_context.get("probe_text", "")),
        }
        tech_task = asyncio.create_task(self._extract_technical(ctx))
        behav_task = asyncio.create_task(self._extract_behavioral(ctx))
        tech, behav = await asyncio.gather(tech_task, behav_task)

        overall_conf = sum(t.get("confidence", 0) for t in tech.get("competency_tags", []))
        overall_conf /= max(len(tech.get("competency_tags", [])), 1)

        return {
            "evidence_id": f"ev-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}",
            "probe_id": probe_context.get("probe_id") or probe_context.get("probeId") or "",
            "raw_transcript": utterance,
            "source_type": "VERBAL_RESPONSE",
            "competencies_tagged": tech.get("competency_tags", []),
            "behavioral_tags": behav.get("behavioral_tags", []),
            "extracted_signals": tech.get("signals", []),
            "demonstrated_skills": tech.get("demonstrated_skills", []),
            "missed_signals": tech.get("missed_signals", []),
            "claims_confirmed": tech.get("claims_confirmed", []),
            "claims_contradicted": tech.get("claims_contradicted", []),
            "ownership_score": behav.get("ownership_score", 0),
            "overall_confidence": overall_conf,
        }

    async def _extract_technical(self, ctx: dict) -> dict:
        r = await self.aiml.client.chat.completions.create(
            model=MODELS["tech_evidence"],
            messages=[
                {"role": "system", "content": TECH_EVIDENCE_PROMPT},
                {"role": "user", "content": json.dumps(ctx)},
            ],
            max_tokens=1024, temperature=0.1,
            response_format={"type": "json_object"},
        )
        return normalize_keys(json.loads(r.choices[0].message.content))

    async def _extract_behavioral(self, ctx: dict) -> dict:
        r = await self.feather.client.chat.completions.create(
            model=MODELS["behav_evidence"],
            messages=[
                {"role": "system", "content": BEHAV_EVIDENCE_PROMPT},
                {"role": "user", "content": json.dumps(ctx)},
            ],
            max_tokens=512, temperature=0.1,
            response_format={"type": "json_object"},
        )
        return normalize_keys(json.loads(r.choices[0].message.content))

    def _extract_section(self, content: str, marker: str) -> str:
        markers = ["UTTERANCE:", "PROBE:"]
        start = content.find(marker)
        if start == -1:
            return ""
        start += len(marker)
        end = len(content)
        for m in markers:
            if m != marker:
                pos = content.find(m, start)
                if pos != -1 and pos < end:
                    end = pos
        return content[start:end].strip()
