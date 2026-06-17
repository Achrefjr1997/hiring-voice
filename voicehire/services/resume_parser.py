import json
import re
from openai import OpenAI

SYSTEM_PROMPT = "You are an expert resume parser. Extract data accurately and return ONLY valid JSON."

USER_PROMPT_TEMPLATE = """Extract the following information from this resume text.
Return ONLY valid JSON with this exact structure (no markdown, no code fences, just raw JSON):

{{"first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone": "string or null",
  "linkedin_url": "string or null",
  "github_url": "string or null",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {{
      "company": "Company Name",
      "title": "Job Title",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or null",
      "description": "Job description..."
    }}
  ],
  "education": [
    {{
      "school": "University Name",
      "degree": "Bachelor/Master/PhD",
      "field": "Field of Study",
      "graduation_year": 2020
    }}
  ],
  "summary": "Professional summary..."}}

Resume text:
{resume_text}"""


def _extract_json(text: str) -> str:
    raw = text.strip()
    if not raw:
        raise ValueError("Empty response from parser")

    # Try to extract JSON from markdown code block first
    block_match = re.search(r"```(?:json)?\s*\n?(.*?)```", raw, re.DOTALL)
    if block_match:
        raw = block_match.group(1).strip()

    # If it doesn't start with { but has JSON structure, try wrapping
    if not raw.startswith("{"):
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            raw = raw[start : end + 1]
        else:
            raise ValueError(f"Response does not contain valid JSON: {raw[:200]}")

    return raw


class ResumeParser:
    def __init__(self, api_key: str, base_url: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def parse(self, resume_text: str) -> dict:
        try:
            prompt = USER_PROMPT_TEMPLATE.format(resume_text=resume_text)
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
            )
            raw = response.choices[0].message.content
            if not raw:
                return {"error": "Empty response from AI parser", "raw_text": resume_text}
            cleaned = _extract_json(raw)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            start = raw[:300] if "raw" in dir() else "N/A"
            return {"error": f"JSON parse error: {e.msg}. Raw: {start}", "raw_text": resume_text}
        except Exception as e:
            return {"error": str(e), "raw_text": resume_text}
