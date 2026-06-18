"""Quick test: create a single session with timing."""
import httpx
import time

t0 = time.time()
try:
    r = httpx.post("http://localhost:8000/session/create", data={
        "jd": "Senior backend engineer. Python, async, distributed systems, PostgreSQL, Redis.",
        "resume": "8 years backend experience. Python, Go, Kafka, Kubernetes.",
        "rubric": "",
        "role_level": "senior",
    }, timeout=120.0)
    t = time.time() - t0
    print("Status:", r.status_code, "Time:", round(t, 1), "s")
    if r.status_code == 200:
        data = r.json()
        print("Session:", data["session_id"])
        print("Foundation:", data["foundation_room_id"][:12], "...")
        print("Exploration:", data["exploration_room_id"][:12], "...")
        print("Committee:", data["committee_room_id"][:12], "...")
    else:
        print("Body:", r.text[:500])
except Exception as e:
    t = time.time() - t0
    print("Error after", round(t, 1), "s:", e)
