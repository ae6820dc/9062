import os
import tempfile
import unittest

# Isolated storage, never a live board database.
_tmp = tempfile.TemporaryDirectory()
os.environ['DB_PATH'] = os.path.join(_tmp.name, 'test.sqlite3')
os.environ['SETUP_TOKEN'] = 'test-only-setup-key-not-a-deployed-secret'
from app import app, connect, init_db
from contextlib import closing


class BoardTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        with closing(connect()) as db, db:
            for table in ('messages', 'settings', 'sessions', 'limits'):
                db.execute('DELETE FROM ' + table)
        self.client.post('/api/setup', json={'setupToken': app.config['SETUP_TOKEN'], 'password':'test-password-only'})

    def login(self, name='Kolléga'):
        response = self.client.post('/api/login', json={'name':name,'password':'test-password-only'})
        self.assertEqual(response.status_code, 200)
        return {'Authorization':'Bearer '+response.json['token']}

    def test_no_public_messages_and_no_password_leak(self):
        self.assertEqual(self.client.get('/api/messages').status_code, 401)
        self.assertEqual(self.client.post('/api/messages', json={'body':'secret'}).status_code, 401)
        self.assertEqual(self.client.get('/app.py').status_code, 404)
        self.assertEqual(self.client.get('/data/board.sqlite3').status_code, 404)
        self.assertEqual(self.client.post('/api/login', json={'name':'X','password':'wrong'}).status_code, 401)
        with closing(connect()) as db:
            hashed = db.execute("SELECT value FROM settings WHERE key='password'").fetchone()['value']
        self.assertTrue(hashed.startswith('scrypt:'))
        self.assertNotEqual(hashed, 'test-password-only')

    def test_setup_is_one_time_and_requires_secret(self):
        self.assertEqual(self.client.post('/api/setup', json={'setupToken':'wrong','password':'long-password'}).status_code, 403)
        self.assertEqual(self.client.post('/api/setup', json={'setupToken':app.config['SETUP_TOKEN'],'password':'long-password'}).status_code, 409)

    def test_send_retrieve_deduplicate_and_persist(self):
        a = self.login('Éva')
        b = self.login('Péter')
        payload = {'body':'Árvíztűrő tükörfúrógép 😎\n<script>alert(1)</script>', 'nonce':'unique-message-1','name':'Fake'}
        first = self.client.post('/api/messages', json=payload, headers=a)
        self.assertEqual(first.status_code, 201)
        self.client.post('/api/messages', json=payload, headers=a)
        init_db()  # Startup must preserve all committed data.
        rows = self.client.get('/api/messages', headers=b).json['messages']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['name'], 'Éva')
        self.assertEqual(rows[0]['body'], payload['body'])
        self.client.post('/api/logout', json={}, headers=a)
        self.assertEqual(self.client.get('/api/messages', headers=a).status_code, 401)
        self.assertEqual(self.client.get('/api/messages', headers=b).status_code, 200)

    def test_pagination_and_concurrent_catchup(self):
        auth = self.login()
        with closing(connect()) as db, db:
            db.executemany('INSERT INTO messages(name,body,created,nonce,session) VALUES (?,?,?,?,?)', [('A',str(i),1000,str(i),'test') for i in range(170)])
        page = self.client.get('/api/messages', headers=auth).json
        self.assertEqual(len(page['messages']), 50)
        self.assertTrue(page['hasOlder'])
        first_id = page['messages'][0]['id']
        older = self.client.get('/api/messages?before='+str(first_id), headers=auth).json
        self.assertTrue(all(row['id'] < first_id for row in older['messages']))
        catchup = self.client.get('/api/messages?after=0', headers=auth).json['messages']
        self.assertEqual(len(catchup), 100)
        rest = self.client.get('/api/messages?after='+str(catchup[-1]['id']), headers=auth).json['messages']
        self.assertEqual(len(rest), 70)

    def test_validation_cors_limits_and_session_expiry(self):
        auth = self.login()
        for body in (' ', 'a'*4001):
            self.assertEqual(self.client.post('/api/messages', json={'body':body,'nonce':'nonce-valid'},headers=auth).status_code,400)
        self.assertEqual(self.client.get('/api/messages?after=999999999999999999999999999',headers=auth).status_code,400)
        bad = dict(auth, Origin='https://evil.example')
        self.assertEqual(self.client.get('/api/messages',headers=bad).status_code,403)
        options = self.client.options('/api/messages', headers={'Origin':'https://ae6820dc.github.io'})
        self.assertEqual(options.headers['Access-Control-Allow-Origin'],'https://ae6820dc.github.io')
        with closing(connect()) as db, db:
            db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.client.get('/api/messages',headers=auth).status_code,401)
        for _ in range(21):
            result = self.client.post('/api/login',json={'name':'A','password':'wrong'})
        self.assertEqual(result.status_code,429)


if __name__ == '__main__':
    unittest.main()
