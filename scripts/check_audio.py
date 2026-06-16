import sqlite3, json, os

con = sqlite3.connect('/app/db_data/voicehire.db')
cur = con.execute("SELECT id, report_json FROM sessions WHERE report_json IS NOT NULL AND report_json != ''")
for sid, rj in cur.fetchall():
    data = json.loads(rj)
    print(f'\n=== {sid} ===')
    print('Top-level keys:', list(data.keys()))
    
    ch = data.get('conversation_history')
    if isinstance(ch, list):
        print(f'conversation_history: {len(ch)} entries')
        if ch:
            print('first entry keys:', list(ch[0].keys()))
            urls = [e.get('audio_url') for e in ch if e.get('audio_url')]
            print(f'entries with audio_url: {len(urls)}')
            if urls:
                for u in urls[:2]:
                    print(f'  sample: {u}')
    else:
        print(f'conversation_history: {type(ch)}')
    
    sections = data.get('sections')
    if isinstance(sections, dict):
        print('sections keys:', list(sections.keys()))
        for k in sections:
            v = sections[k]
            if isinstance(v, list):
                print(f'  {k}: {len(v)} items')
                if v:
                    print(f'    first item keys: {list(v[0].keys()) if isinstance(v[0], dict) else type(v[0])}')
            elif isinstance(v, dict):
                print(f'  {k}: dict with keys {list(v.keys())}')
    
    # Check for audio files
    audio_dir = '/app/audio_output/'
    if os.path.isdir(audio_dir):
        matches = [f for f in os.listdir(audio_dir) if f.startswith(sid)]
        print(f'audio files in bind mount: {len(matches)}')
        if matches:
            print(f'  examples: {matches[:3]}')

con.close()
