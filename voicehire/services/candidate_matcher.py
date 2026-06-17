import json
import re
from openai import OpenAI

SYSTEM_PROMPT = """You are an expert AI recruiter and talent matcher. Your task is to rank candidates against a job description.
Evaluate based on:
1. Skills match (weight: 40%)
2. Experience relevance (weight: 30%)
3. Education & background (weight: 15%)
4. Past interview performance (weight: 10%)
5. Overall culture & domain fit (weight: 5%)

Return candidates sorted by match score (0-100). Be objective and data-driven."""

USER_PROMPT_TEMPLATE = """Rank the following candidates against this job posting. Return ONLY valid JSON with this exact structure (no markdown, no code fences):

{{"matches": [
  {{
    "candidate_id": "id",
    "score": 0-100,
    "rank": 1,
    "strengths": ["strength1", "strength2"],
    "gaps": ["gap1", "gap2"],
    "reasoning": "Why this score for this candidate..."
  }}
]}}

Output at most {limit} matches, sorted by score descending.

--- JOB POSTING ---
Title: {job_title}
Department: {department}
Description: {description}
Requirements: {requirements}
Required Skills: {required_skills}

--- CANDIDATES ---
{candidates_text}"""


def _extract_json(text: str) -> str:
    raw = text.strip()
    if not raw:
        raise ValueError("Empty response from matcher")
    block_match = re.search(r"```(?:json)?\s*\n?(.*?)```", raw, re.DOTALL)
    if block_match:
        raw = block_match.group(1).strip()
    if not raw.startswith("{"):
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            raw = raw[start: end + 1]
        else:
            raise ValueError(f"Response does not contain valid JSON: {raw[:200]}")
    return raw


class CandidateMatcher:
    def __init__(self, api_key: str, base_url: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def rank_candidates(self, job: dict, candidates: list[dict], limit: int = 10) -> list[dict]:
        try:
            candidates_text = ""
            for c in candidates:
                perf = ""
                if c.get("past_scores"):
                    perf = f"Past interview scores: {c['past_scores']}"
                skills_str = ", ".join(c.get("skills", [])) or "Not listed"
                exp_str = "; ".join(
                    f"{e.get('title', '')} at {e.get('company', '')} ({e.get('start_date', '')} - {e.get('end_date', '')})"
                    for e in (c.get("experience") or [])
                ) or "Not listed"
                edu_str = "; ".join(
                    f"{e.get('degree', '')} in {e.get('field', '')} from {e.get('school', '')}"
                    for e in (c.get("education") or [])
                ) or "Not listed"
                candidates_text += f"""
--- Candidate {c.get('first_name', '')} {c.get('last_name', '')} ({c.get('email', '')}) ---
ID: {c.get('id', '')}
Skills: {skills_str}
Experience: {exp_str}
Education: {edu_str}
Summary: {c.get('summary', '')}
{perf}
"""

            prompt = USER_PROMPT_TEMPLATE.format(
                limit=limit,
                job_title=job.get("title", ""),
                department=job.get("department", ""),
                description=job.get("description", ""),
                requirements=job.get("requirements", ""),
                required_skills=", ".join(job.get("required_skills", [])),
                candidates_text=candidates_text,
            )
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )
            raw = response.choices[0].message.content
            if not raw:
                return []
            cleaned = _extract_json(raw)
            result = json.loads(cleaned)
            matches = result.get("matches", [])
            matches.sort(key=lambda x: x.get("score", 0), reverse=True)
            for i, m in enumerate(matches):
                m["rank"] = i + 1
            return matches
        except Exception as e:
            print(f"[candidate_matcher] Error: {e}")
            return []
