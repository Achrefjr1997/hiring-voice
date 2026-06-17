import json
from openai import OpenAI

SYSTEM_PROMPT = "You are an expert HR professional and job description writer. Generate professional, detailed job descriptions."

USER_PROMPT_TEMPLATE = """Generate a professional job description and requirements for the following role.
Return ONLY valid JSON with this exact structure:

{{"description": "A detailed 3-4 paragraph job description covering responsibilities, impact, and team context...",
  "requirements": "A bullet-point list of required qualifications and experience..."}}

Job Title: {job_title}
Key Skills: {skills}"""


class JobDescriptionGenerator:
    def __init__(self, api_key: str, base_url: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def generate(self, job_title: str, skills: list[str]) -> dict:
        try:
            skills_str = ", ".join(skills) if skills else "Not specified"
            prompt = USER_PROMPT_TEMPLATE.format(job_title=job_title, skills=skills_str)
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )
            raw = response.choices[0].message.content
            if not raw:
                return {"error": "Empty response"}
            # Try to extract JSON block
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                raw = raw[start : end + 1]
            result = json.loads(raw)
            # Ensure requirements is a string, not an array
            if isinstance(result.get("requirements"), list):
                result["requirements"] = "\n".join(f"- {r}" for r in result["requirements"])
            return result
        except Exception as e:
            return {"error": str(e)}
