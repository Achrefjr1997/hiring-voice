import json
from voicehire.api.client import FeatherlessClient, MODELS
from voicehire.band.agent_base import BandAgent
from voicehire.util import normalize_keys

SKEPTIC_SYSTEM = """You are a rigorous technical interviewer playing devil's advocate.
Decide if the confidence score is justified by what was actually said.

Output JSON only:
{
  "shouldChallenge": true/false,
  "challengeReason": "...",
  "adjustedConfidence": 0.0-1.0,
  "thinkingTrace": "..."
}

Only challenge when confidence >= 0.80 and the evidence is thin or unsupported."""


class IntegritySkeptic(BandAgent):

    def __init__(self, brain_id: str):
        super().__init__(
            handle="integrity-skeptic",
            token_env_var="BAND_TOKEN_INTEGRITY_SKEPTIC",
        )
        self.client = FeatherlessClient()
        self.brain_id = brain_id

    async def handle_mention(self, room_id: str, message: dict) -> None:
        content = message.get("content", "")
        if "EVALUATE:" not in content:
            return
        evidence_json = content.split("EVALUATE:", 1)[1].strip()
        evidence_node = json.loads(evidence_json)
        await self.evaluate(room_id, evidence_node)

    async def evaluate(self, room_id: str, evidence_node: dict) -> None:
        high_conf_tags = [
            t for t in evidence_node.get("competencies_tagged", [])
            if t.get("confidence", 0) >= 0.80 and t.get("polarity") == "POSITIVE"
        ]
        if not high_conf_tags:
            return

        eval_input = {
            "transcript": evidence_node["raw_transcript"],
            "highConfidenceTags": high_conf_tags,
            "extractedSignals": evidence_node.get("extracted_signals", []),
        }

        r = await self.client.client.chat.completions.create(
            model=MODELS["skeptic"],
            messages=[
                {"role": "system", "content": SKEPTIC_SYSTEM},
                {"role": "user", "content": json.dumps(eval_input)},
            ],
            max_tokens=1024, temperature=0.3,
            response_format={"type": "json_object"},
        )

        result = normalize_keys(json.loads(r.choices[0].message.content))

        if result.get("should_challenge"):
            adjustments = {
                t["competency_id"]: result["adjusted_confidence"]
                for t in high_conf_tags
            }
            await self.send_to_agent(room_id, "Session Brain", self.brain_id,
                                     f"CHALLENGE: {result['challenge_reason']} "
                                     f"ADJUSTED_CONFIDENCE: {json.dumps(adjustments)}")
            print(f"[integrity-skeptic] Challenge issued for {len(high_conf_tags)} tag(s)")
