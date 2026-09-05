"""Security and persistence contracts for the actual public Flask application."""
import copy
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from .database import connect, initialize, backup_database
from .web import create_app

ORIGIN = 'http://localhost:8000'
HEADERS = {'Origin': ORIGIN, 'X-Campus-Request': '1'}
PASSWORD = 'test-only-password-943!'


def state():
    return dict(departmentId='kikai', entranceYear=2022,
                settings=dict(title='時間割', days=['月'], periods=[dict(id=1, label='1限', time='09:20')], showTime=True),
                allYearsData={year: dict(timetable={}, quarterRanges={q: dict(start='', end='') for q in ['1Q', '2Q', '3Q', '4Q']}) for year in ['1年次', '2年次', '3年次', '4年次', 'M1', 'M2']})


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'accounts.sqlite3'
        self.env = patch.dict(os.environ, CURRICULUM_DB_PATH=str(self.path), PUBLIC_ORIGIN='')
        self.env.start()
        initialize()
        with connect() as db:
            db.execute("INSERT INTO faculties VALUES ('rikou','理工学部')")
            db.execute("INSERT INTO departments VALUES ('kikai','rikou','機械工学科')")
            db.execute("INSERT INTO cohort_datasets VALUES ('kikai',2022,'partial',0,'{}')")
        self.app = create_app({'TESTING': True})
        self.client = self.app.test_client()

    def tearDown(self):
        self.env.stop()
        self.directory.cleanup()

    def register(self, client=None, username='student_one'):
        client = client or self.client
        response = client.post('/api/auth/register', headers=HEADERS, json=dict(username=username, password=PASSWORD, departmentId='kikai', entranceYear=2022))
        self.assertEqual(response.status_code, 200, response.json)
        return client.get('/api/me').json

    def headers(self, me):
        return dict(HEADERS, **{'X-CSRF-Token': me['csrfToken']})

    def test_registration_hash_cookie_and_options(self):
        me = self.register()
        self.assertEqual((me['departmentId'], me['entranceYear']), ('kikai', 2022))
        self.assertNotIn('password', json.dumps(me))
        with connect() as db:
            encoded = db.execute('SELECT password_hash FROM accounts').fetchone()[0]
            self.assertTrue(encoded.startswith('$argon2id$'))
            self.assertNotIn(PASSWORD, encoded)
            self.assertNotEqual(db.execute('SELECT token_hash FROM account_sessions').fetchone()[0], self.client.get_cookie('campus_session').value)
        cookie = self.client.get_cookie('campus_session')
        self.assertTrue(cookie.http_only)
        self.assertEqual(cookie.same_site, 'Lax')
        self.assertEqual(len(self.client.get('/api/registration-options').json), 1)

    def test_anonymous_and_removed_uuid_endpoints(self):
        for path in ['/api/me', '/api/me/profile']:
            self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.put('/api/me/state', headers=HEADERS, json={}).status_code, 401)
        self.assertEqual(self.client.get('/api/students/any-id').status_code, 404)
        self.assertEqual(self.client.put('/api/students/any-id', headers=HEADERS, json={}).status_code, 405)

    def test_cross_account_isolation_and_relogin_persistence(self):
        first = self.register()
        data = state()
        data['allYearsData']['1年次']['timetable'] = {'1Q': {'月': {'1': dict(title='数学', credits=2, grade='優')}}}
        response = self.client.put('/api/me/state', headers=self.headers(first), json=dict(state=data, revision=0))
        self.assertEqual(response.status_code, 200)
        second = self.app.test_client()
        other = self.register(second, 'student_two')
        self.assertIsNone(second.get('/api/me').json['state'])
        self.assertEqual(second.put('/api/me/state', headers=self.headers(first), json=dict(state=data, revision=0)).status_code, 403)
        self.assertEqual(self.client.post('/api/me/logout', headers=self.headers(first), json={}).status_code, 200)
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', headers=HEADERS, json=dict(username='STUDENT_ONE', password=PASSWORD)).status_code, 200)
        self.assertEqual(self.client.get('/api/me').json['state'], data)
        self.assertNotEqual(other['id'], first['id'])

    def test_csrf_origin_and_host_rejected(self):
        me = self.register()
        for headers in [{}, HEADERS, dict(self.headers(me), Origin='https://evil.example'), {'X-CSRF-Token': me['csrfToken']}]:
            self.assertEqual(self.client.put('/api/me/state', headers=headers, json=dict(state=state(), revision=0)).status_code, 403)
        self.assertEqual(self.client.get('/api/me', headers={'Host': 'evil.example'}).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login', json={}).status_code, 403)

    def test_conflicts_and_invalid_shapes_preserve_saved_data(self):
        me = self.register()
        self.assertEqual(self.client.put('/api/me/state', headers=self.headers(me), json=dict(state=state(), revision=0)).status_code, 200)
        self.assertEqual(self.client.put('/api/me/state', headers=self.headers(me), json=dict(state=state(), revision=0)).status_code, 409)
        for field, value in [('allYearsData', []), ('settings', None), ('entranceYear', 2100)]:
            bad = state(); bad[field] = value
            self.assertEqual(self.client.put('/api/me/state', headers=self.headers(me), json=dict(state=bad, revision=1)).status_code, 400)
        self.assertEqual(self.client.get('/api/me').json['revision'], 1)
        self.assertEqual(self.client.get('/api/me').json['state'], state())

    def test_program_combinations_are_per_account(self):
        import itertools
        me = self.register()
        revision = 0
        for teacher, hirameki, tap in itertools.product([False, True], repeat=3):
            data = dict(departmentId='kikai', entranceYear=2022, isGeneral=True, takesTeacher=teacher, takesHirameki=hirameki, takesTap=tap, individualNote='', revision=revision)
            response = self.client.put('/api/me/profile', headers=self.headers(me), json=data)
            self.assertEqual(response.status_code, 200)
            revision = response.json['revision']
            self.assertEqual(self.client.get('/api/me/profile').json, dict(data, revision=revision))
        other = self.app.test_client(); self.register(other, 'student_two')
        self.assertIsNone(other.get('/api/me/profile').json)

    def test_duplicate_validation_and_rate_limit(self):
        self.register()
        duplicate = dict(username='STUDENT_ONE', password=PASSWORD, departmentId='kikai', entranceYear=2022)
        self.assertEqual(self.client.post('/api/auth/register', headers=HEADERS, json=duplicate).status_code, 409)
        self.assertEqual(self.client.post('/api/auth/register', headers=HEADERS, json=dict(duplicate, username='new_student', entranceYear=2099)).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/register', headers=HEADERS, json=dict(duplicate, password='short')).status_code, 400)
        with connect() as db:
            db.execute('UPDATE auth_attempts SET attempts=100')
        self.assertEqual(self.client.post('/api/auth/login', headers=HEADERS, json=dict(username='student_one', password=PASSWORD)).status_code, 429)

    def test_session_expiration_revocation_and_backup(self):
        me = self.register()
        cookie = self.client.get_cookie('campus_session').value
        self.client.post('/api/me/logout', headers=self.headers(me), json={})
        self.client.set_cookie('campus_session', cookie)
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.client.post('/api/auth/login', headers=HEADERS, json=dict(username='student_one', password=PASSWORD))
        with connect() as db:
            db.execute('UPDATE account_sessions SET expires_at=?', (int(time.time()) - 1,))
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        destination = Path(self.directory.name) / 'backup.sqlite3'
        backup_database(destination)
        with connect(destination) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM accounts').fetchone()[0], 1)

    def test_https_cookie_and_security_headers(self):
        app = create_app({'PUBLIC_ORIGIN': 'https://campus.example', 'ALLOWED_ORIGINS': {'https://campus.example'}, 'TRUSTED_HOSTS': ['campus.example']})
        client = app.test_client()
        response = client.post('/api/auth/register', base_url='https://campus.example', headers={'Origin': 'https://campus.example', 'X-Campus-Request': '1'}, json=dict(username='secure_user', password=PASSWORD, departmentId='kikai', entranceYear=2022))
        self.assertEqual(response.status_code, 200)
        self.assertIn('__Host-campus_session=', response.headers['Set-Cookie'])
        self.assertIn('Secure;', response.headers['Set-Cookie'])
        self.assertIn('HttpOnly;', response.headers['Set-Cookie'])
        self.assertIn('Content-Security-Policy', response.headers)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_oversize_and_non_json_requests(self):
        me = self.register()
        self.assertEqual(self.client.put('/api/me/state', headers=self.headers(me), data='x' * (1024 * 1024 + 1), content_type='application/json').status_code, 413)
        self.assertEqual(self.client.put('/api/me/state', headers=self.headers(me), data='hello', content_type='text/plain').status_code, 415)


if __name__ == '__main__':
    unittest.main()
