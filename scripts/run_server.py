import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import uvicorn
from dotenv import load_dotenv
load_dotenv()

log_file = open("server_debug.log", "w", buffering=1)
sys.stdout = log_file
sys.stderr = log_file

if __name__ == "__main__":
    uvicorn.run("voicehire.api.server:app", host="127.0.0.1", port=8000, log_level="info")
