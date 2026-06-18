import sys, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from voicehire.band.session_factory import BandSessionFactory

factory = BandSessionFactory()
session_id = uuid.uuid4().hex[:8]
session = factory.create_session(session_id)
print(f"Foundation:  {session.foundation_room_id}")
print(f"Exploration: {session.exploration_room_id}")
print(f"Committee:   {session.committee_room_id}")
print("ALL OK")
