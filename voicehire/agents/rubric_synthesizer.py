import json
from voicehire.api.client import AIMLAPIClient, MODELS
from voicehire.band.agent_base import BandAgent

RUBRIC_SYSTEM_PROMPT = """You are a principal-level engineer and hiring expert.
Extract a structured competency model from a job description.
Do NOT generate questions. Identify what a candidate must DEMONSTRATE.

Output ONLY valid JSON. No explanation. No preamble. No backticks.

Each competency MUST have these exact camelCase keys:
- competencyId (string, unique)
- name (string)
- domain (string, e.g. "backend", "system-design", "leadership")
- classification (string, one of: "MUST_HAVE" or "NICE_TO_HAVE")
- depthRequired (string, one of: "surface", "applied", "expert")
- minEvidenceCount (integer, minimum evidence items needed, typically 2)
- minConfidence (float, between 0.0 and 1.0, typically 0.6)
- weight (float, sum of all weights across competencies must be ~1.0)

Top-level schema:
{
  "competencies": [<list of competency objects>],
  "domainWeights": {<domain string>: <float>, ...},
  "skillImplications": {<skill string>: {<competencyId string>: <float>, ...}, ...}
}

All weights across competencies must sum to ~1.0 (tolerance ±0.15)."""


from voicehire.util import normalize_keys


REQUIRED_KEYS = ["competencies", "domainWeights", "skillImplications"]
COMPETENCY_KEYS = [
    "competencyId", "name", "domain", "classification",
    "depthRequired", "minEvidenceCount", "minConfidence", "weight",
]


def validate_competency_graph(graph: dict) -> dict:
    """Validate and normalize a rubric graph."""
    for key in REQUIRED_KEYS:
        assert key in graph, f"Missing top-level key: {key}"

    comps = graph["competencies"]
    assert isinstance(comps, list) and len(comps) > 0, "competencies must be a non-empty list"

    for i, c in enumerate(comps):
        for k in COMPETENCY_KEYS:
            assert k in c, f"Competency #{i} missing key: {k}"
        assert c["classification"] in ("MUST_HAVE", "NICE_TO_HAVE"), \
            f"Competency #{i} invalid classification: {c['classification']}"
        assert c["depthRequired"] in ("surface", "applied", "expert"), \
            f"Competency #{i} invalid depth: {c['depthRequired']}"
        assert isinstance(c["weight"], (int, float)) and c["weight"] > 0, \
            f"Competency #{i} invalid weight: {c['weight']}"

    weight_sum = sum(c["weight"] for c in comps)
    assert 0.85 <= weight_sum <= 1.15, \
        f"Weights sum to {weight_sum:.2f}, expected ~1.0 (tolerance ±0.15)"

    assert isinstance(graph["domainWeights"], dict), "domainWeights must be a dict"
    assert all(isinstance(v, (int, float)) for v in graph["domainWeights"].values()), \
        "domainWeights values must be floats"

    assert isinstance(graph["skillImplications"], dict), "skillImplications must be a dict"

    return normalize_keys(graph)


class RubricSynthesizer(BandAgent):

    def __init__(self, brain_id: str):
        super().__init__(
            handle="rubric-synthesizer",
            token_env_var="BAND_TOKEN_RUBRIC_SYNTHESIZER",
        )
        self.llm = AIMLAPIClient()
        self.brain_id = brain_id

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message["content"]
        jd     = self._extract_section(content, "JD:")
        resume = self._extract_section(content, "RESUME:")
        rubric = self._extract_section(content, "RUBRIC:")
        level  = self._extract_section(content, "LEVEL:") or "senior"

        print(f"[rubric-synthesizer] Received JD ({len(jd)} chars), Resume ({len(resume)} chars), Level={level}")

        graph = await self.synthesize(jd, resume, rubric, level)

        graph_json = json.dumps(graph)
        await self.send_event(room_id, f"COMPETENCY_GRAPH_READY: {graph_json}")
        await self.send_to_agent(room_id, "Session Brain", self.brain_id,
                                  f"COMPETENCY_GRAPH_READY: {graph_json}")
        print(f"[rubric-synthesizer] Posted COMPETENCY_GRAPH_READY ({len(graph_json)} chars)")

    async def synthesize(self, jd: str, resume: str, rubric: str,
                         role_level: str) -> dict:
        user_content = (
            f"JD TEXT:\n{jd}\n\nCOMPANY RUBRIC:\n{rubric}\n\n"
            f"CANDIDATE RESUME:\n{resume}\nROLE LEVEL: {role_level}\n\n"
            f"Generate the complete CompetencyGraph including skillImplications."
        )

        for attempt in range(3):
            response = await self.llm.client.chat.completions.create(
                model=MODELS["rubric"],
                messages=[
                    {"role": "system", "content": RUBRIC_SYSTEM_PROMPT},
                    {"role": "user",   "content": user_content},
                ],
                max_tokens=4096,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            try:
                graph = json.loads(raw)
                normalized = validate_competency_graph(graph)
                print(f"[rubric-synthesizer] Graph validated on attempt {attempt + 1}: "
                      f"{len(normalized['competencies'])} competencies")
                return normalized
            except (json.JSONDecodeError, AssertionError) as e:
                print(f"[rubric-synthesizer] Validation failed attempt {attempt + 1}: {e}")
                if attempt == 2:
                    raise RuntimeError(f"Rubric generation failed after 3 attempts: {e}")
                user_content += f"\n\nPrevious attempt failed validation: {e}. Fix and retry."

    def _extract_section(self, content: str, marker: str) -> str:
        markers = ["JD:", "RESUME:", "RUBRIC:", "LEVEL:"]
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
