"""Private work message board. Run behind Render's HTTPS proxy."""
import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
app.config.update(MAX_CONTENT_LENGTH=24000, DB_PATH=os.environ.get('DB_PATH', str(ROOT / 'data' / 'board.sqlite3')), SETUP_TOKEN=os.environ.get('SETUP_TOKEN', ''))
if os.environ.get('RENDER'):
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1)
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', 'https://ae6820dc.github.io')


def connect():
    db = sqlite3.connect(app.config['DB_PATH'], timeout=15)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    Path(app.config['DB_PATH']).parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, nonce TEXT NOT NULL, session TEXT NOT NULL, UNIQUE(session,nonce));
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL);
        ''')
        db.commit()


def password_hash():
    with closing(connect()) as db:
        row = db.execute("SELECT value FROM settings WHERE key='password'").fetchone()
        return row['value'] if row else None


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def session():
    token = request.headers.get('Authorization', '')
    if not token.startswith('Bearer ') or len(token) > 160:
        return None
    with closing(connect()) as db:
        return db.execute('SELECT token,name FROM sessions WHERE token=? AND expires>?', (digest(token[7:]), int(time.time()))).fetchone()


def limit(key, count, window):
    now = int(time.time())
    with closing(connect()) as db, db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM limits WHERE start<?', (now - 86400,))
        row = db.execute('SELECT start,count FROM limits WHERE key=?', (key,)).fetchone()
        if row and now - row['start'] < window:
            if row['count'] >= count:
                return False
            db.execute('UPDATE limits SET count=count+1 WHERE key=?', (key,))
        else:
            db.execute('INSERT OR REPLACE INTO limits VALUES (?,?,1)', (key, now))
    return True


@app.before_request
def protect_origin():
    origin = request.headers.get('Origin')
    if origin and origin not in (ALLOWED_ORIGIN, request.host_url.rstrip('/')):
        return jsonify(error='Erről az oldalról nem érhető el az üzenőfal.'), 403
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'POST' and not request.is_json:
        return jsonify(error='JSON kérés szükséges.'), 415


@app.after_request
def headers(response):
    origin = request.headers.get('Origin')
    if origin == ALLOWED_ORIGIN:
        response.headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"
    return response


@app.errorhandler(413)
def too_large(_):
    return jsonify(error='Túl hosszú az üzenet.'), 413


@app.errorhandler(400)
def bad_request(_):
    return jsonify(error='Hibás kérés.'), 400


@app.get('/')
def home():
    return send_from_directory(ROOT, 'index.html')


@app.get('/<name>')
def asset(name):
    if name in {'app.js', 'style.css', 'config.js', 'icon.svg'}:
        return send_from_directory(ROOT, name)
    return jsonify(error='Nincs ilyen oldal.'), 404


@app.get('/health')
def health():
    with closing(connect()) as db:
        db.execute('SELECT 1').fetchone()
    return jsonify(ok=True)


@app.get('/api/status')
def status():
    return jsonify(configured=password_hash() is not None)


def data():
    value = request.get_json()
    return value if isinstance(value, dict) else {}


@app.post('/api/setup')
def setup():
    value = data()
    key = app.config['SETUP_TOKEN']
    supplied = value.get('setupToken', '')
    if not key or not isinstance(supplied, str) or not hmac.compare_digest(digest(supplied), digest(key)):
        return jsonify(error='Érvénytelen beállítási kulcs.'), 403
    if password_hash():
        return jsonify(error='Az üzenőfal jelszava már be van állítva.'), 409
    password = value.get('password', '')
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        return jsonify(error='A jelszó 8–128 karakter legyen.'), 400
    hashed = generate_password_hash(password, method='scrypt')
    with closing(connect()) as db, db:
        result = db.execute("INSERT OR IGNORE INTO settings VALUES ('password',?)", (hashed,))
        if result.rowcount != 1:
            return jsonify(error='A jelszó már be van állítva.'), 409
    return jsonify(ok=True)


@app.post('/api/login')
def login():
    # Only trust proxy forwarding on Render, where the application is behind its proxy.
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '') if os.environ.get('RENDER') else request.remote_addr or ''
    ip = ip.split(',')[-1].strip()
    if not limit('login:' + digest(ip), 20, 900):
        return jsonify(error='Túl sok belépési kísérlet. Próbáld újra 15 perc múlva.'), 429
    hashed = password_hash()
    if not hashed:
        return jsonify(error='Az üzenőfal beállítása még folyamatban van.'), 503
    value = data()
    name, password = value.get('name', ''), value.get('password', '')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 40:
        return jsonify(error='Adj meg egy 1–40 karakteres nevet.'), 400
    if not isinstance(password, str) or len(password) > 128 or not check_password_hash(hashed, password):
        return jsonify(error='Hibás jelszó.'), 401
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with closing(connect()) as db, db:
        db.execute('DELETE FROM sessions WHERE expires<=?', (now,))
        db.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), name.strip(), now + 43200))
    return jsonify(token=token, name=name.strip())


@app.post('/api/logout')
def logout():
    current = session()
    if current:
        with closing(connect()) as db, db:
            db.execute('DELETE FROM sessions WHERE token=?', (current['token'],))
    return jsonify(ok=True)


@app.get('/api/messages')
def messages():
    current = session()
    if not current:
        return jsonify(error='Jelentkezz be az üzenetek megtekintéséhez.'), 401
    try:
        after = int(request.args.get('after', 0))
        before = int(request.args.get('before', 0))
        if min(after, before) < 0 or max(after, before) > 9223372036854775807:
            raise ValueError()
    except ValueError:
        return jsonify(error='Hibás lapozás.'), 400
    with closing(connect()) as db:
        if 'after' in request.args:
            rows = db.execute('SELECT id,name,body,created FROM messages WHERE id>? ORDER BY id LIMIT 100', (after,)).fetchall()
        elif before:
            rows = list(reversed(db.execute('SELECT id,name,body,created FROM messages WHERE id<? ORDER BY id DESC LIMIT 50', (before,)).fetchall()))
        else:
            rows = list(reversed(db.execute('SELECT id,name,body,created FROM messages ORDER BY id DESC LIMIT 50').fetchall()))
        oldest = rows[0]['id'] if rows else before
        has_older = bool(db.execute('SELECT 1 FROM messages WHERE id<? LIMIT 1', (oldest,)).fetchone())
    return jsonify(messages=[dict(row) for row in rows], hasOlder=has_older, name=current['name'])


@app.post('/api/messages')
def send_message():
    current = session()
    if not current:
        return jsonify(error='Jelentkezz be az üzenetküldéshez.'), 401
    value = data()
    body, nonce = value.get('body', ''), value.get('nonce', '')
    if not isinstance(body, str) or not 1 <= len(body.strip()) <= 4000:
        return jsonify(error='Az üzenet 1–4000 karakter legyen.'), 400
    if not isinstance(nonce, str) or not 8 <= len(nonce) <= 80:
        return jsonify(error='Hibás üzenetazonosító.'), 400
    if not limit('send:' + current['token'], 12, 30):
        return jsonify(error='Kicsit túl gyorsan küldesz. Várj fél percet.'), 429
    with closing(connect()) as db, db:
        db.execute('INSERT OR IGNORE INTO messages (name,body,created,nonce,session) VALUES (?,?,?,?,?)', (current['name'], body.strip(), int(time.time()), nonce, current['token']))
        row = db.execute('SELECT id,name,body,created FROM messages WHERE session=? AND nonce=?', (current['token'], nonce)).fetchone()
    return jsonify(message=dict(row)), 201


init_db()
