import asyncio
import aiosmtplib
from email.message import EmailMessage
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM

INVITE_SUBJECT = "You've been invited to a VoiceHire interview"
INVITE_BODY = """
Hi {candidate_name},

You have been invited to complete a VoiceHire AI-powered interview.

Click the link below to begin:
{interview_link}

The interview will assess your skills across key competencies related to the role.
Estimated duration: {duration_minutes} minutes.

You will need:
- A quiet environment
- A working microphone
- A modern web browser (Chrome, Firefox, or Edge)

Please complete the interview in one sitting. The system will guide you through each step.

Best regards,
The VoiceHire Team
"""


async def send_invite_email(
    to_email: str,
    candidate_name: str,
    interview_link: str,
    duration_minutes: int = 30,
) -> bool:
    if not SMTP_HOST:
        print(f"[email] SMTP not configured — skipping email to {to_email}")
        return False
    try:
        msg = EmailMessage()
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = INVITE_SUBJECT
        body = INVITE_BODY.format(
            candidate_name=candidate_name or "Candidate",
            interview_link=interview_link,
            duration_minutes=duration_minutes,
        )
        msg.set_content(body.strip())

        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[email] Invite sent to {to_email}")
        return True
    except Exception as e:
        print(f"[email] Failed to send invite to {to_email}: {e}")
        return False
