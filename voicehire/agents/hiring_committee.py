import json
from voicehire.api.client import AIMLAPIClient, MODELS
from voicehire.band.agent_base import BandAgent
from voicehire.util import normalize_keys

ADVOCATE_PROMPT = """You are the Technical Advocate. Present the strongest case FOR hiring based on evidence. Cite evidence IDs."""
CRITIC_PROMPT = """You are the Evidence Critic. Identify gaps, weak evidence, insufficient MUST_HAVE coverage. Be rigorous."""
CHAIR_PROMPT = """You are the Committee Chair. Synthesize Advocate and Critic into a final HiringDecision JSON.
Output JSON only:
{
  "finalRecommendation": "STRONG_HIRE"|"HIRE"|"NO_HIRE"|"STRONG_NO_HIRE",
  "competencyVerdicts": {
    "<competencyId>": {"verdict": "DEMONSTRATED"|"WEAK"|"NOT_DEMONSTRATED"|"EVIDENCE_INSUFFICIENT", "keyEvidenceIds": [...], "depthReached": "surface"|"applied"|"expert", "integrityFlagged": false}
  },
  "evidenceGaps": ["..."],
  "mustHaveTotal": 0,
  "mustHaveDemonstrated": 0,
  "consensusReached": true,
  "advocateSummary": "...",
  "criticSummary": "..."
}"""


class HiringCommittee(BandAgent):

    def __init__(self, brain_id: str):
        super().__init__(
            handle="hiring-committee",
            token_env_var="BAND_TOKEN_HIRING_COMMITTEE",
        )
        self.client = AIMLAPIClient()
        self.brain_id = brain_id
        self._evidence_nodes: list[dict] = []

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message["content"]
        if "EVIDENCE:" in content:
            ev_json = content.split("EVIDENCE:", 1)[1].strip()
            self._evidence_nodes.append(json.loads(ev_json))
        elif "SESSION_END:" in content:
            portfolio_json = content.split("PORTFOLIO:", 1)[1].strip() if "PORTFOLIO:" in content else "{}"
            portfolio = json.loads(portfolio_json)
            await self._deliberate(room_id, portfolio)

    async def _deliberate(self, room_id: str, portfolio: dict) -> None:
        summary = json.dumps(portfolio, indent=2)

        advocate = await self._call(ADVOCATE_PROMPT, f"Evidence portfolio:\n{summary}\nPresent your case.")
        critic = await self._call(CRITIC_PROMPT, f"Portfolio:\n{summary}\nAdvocate:\n{advocate}\nIdentify gaps.")
        chair = await self._call(
            CHAIR_PROMPT,
            f"Portfolio:\n{summary}\nAdvocate:\n{advocate}\nCritic:\n{critic}\nHiringDecision JSON:",
            response_format={"type": "json_object"},
        )

        decision = normalize_keys(json.loads(chair))
        decision["deliberation_transcript"] = {
            "advocate": advocate,
            "critic": critic,
        }
        decision["model_used"] = MODELS["committee"]

        await self.send_message(room_id, f"COMMITTEE_DECISION: {json.dumps(decision)}")
        await self.send_message(room_id, "REPORT_READY")
        print(f"[hiring-committee] Decision: {decision.get('final_recommendation', 'UNKNOWN')}")

    async def _call(self, system: str, user: str, response_format: dict | None = None) -> str:
        kwargs = {
            "model": MODELS["committee"],
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": 2048,
            "temperature": 0.4,
        }
        if response_format:
            kwargs["response_format"] = response_format
        r = await self.client.client.chat.completions.create(**kwargs)
        return r.choices[0].message.content
