import sqlite3

con = sqlite3.connect('/app/db_data/voicehire.db')
tables = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
s = con.execute('SELECT COUNT(*) FROM sessions').fetchone()
u = con.execute('SELECT COUNT(*) FROM users').fetchone()
e = con.execute('SELECT COUNT(*) FROM events').fetchone()
print('tables:', [c[0] for c in tables])
print(f'sessions: {s[0]}, users: {u[0]}, events: {e[0]}')
con.close()
