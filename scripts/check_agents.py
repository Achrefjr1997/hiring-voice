import os, httpx, json, sys
from dotenv import load_dotenv
load_dotenv()
token = os.environ.get('BRANDAPIKEY', '')
print(f"Token: {token[:20]}...", file=sys.stderr)
headers = {'X-API-Key': token, 'Content-Type': 'application/json'}
try:
    with httpx.Client(base_url='https://app.band.ai/api/v1', headers=headers) as c:
        r = c.get('/me/agents')
        print(f"Status: {r.status_code}", file=sys.stderr)
        agents = r.json().get('data', [])
        for a in agents:
            handle = a.get('handle', '').split('/')[-1]
            print(f'{a["name"]} -> id={a["id"]} handle={handle}')
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
