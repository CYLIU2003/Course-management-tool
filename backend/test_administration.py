import time
import unittest

from .database import connect
from . import test_accounts
HEADERS = test_accounts.HEADERS


class AdministrationTests(unittest.TestCase):
    setUp = test_accounts.AccountTests.setUp
    tearDown = test_accounts.AccountTests.tearDown
    register = test_accounts.AccountTests.register
    headers = test_accounts.AccountTests.headers

    def test_student_cannot_grant_role_or_read_admin_analytics(self):
        me = self.register()
        self.assertFalse(me['isAdmin'])
        self.assertEqual(self.client.get('/api/me/admin/analytics').status_code, 403)
        self.assertEqual(self.client.get('/api/me/admin/support').status_code, 403)
        self.assertEqual(self.client.put('/api/me/admin/role', headers=self.headers(me), json={'isAdmin': True}).status_code, 403)

    def test_ticket_owner_and_admin_reply(self):
        me = self.register()
        response = self.client.post('/api/me/support', headers=self.headers(me), json={'subject': '時間割の質問', 'body': '登録方法を教えてください。'})
        self.assertEqual(response.status_code, 201)
        ticket_id = response.json['id']
        other = self.app.test_client(); other_me = self.register(other, 'other_student')
        self.assertEqual(other.get('/api/me/support/' + ticket_id).status_code, 404)
        self.assertEqual(other.post('/api/me/support/' + ticket_id, headers=self.headers(other_me), json={'body': 'forged'}).status_code, 404)
        self.assertEqual(self.client.put('/api/me/support/' + ticket_id, headers=self.headers(me), json={'status': 'closed'}).status_code, 403)
        with connect() as db:
            db.execute('INSERT INTO admin_members VALUES (?,?)', (other_me['id'], int(time.time())))
        response = other.post('/api/me/support/' + ticket_id, headers=self.headers(other_me), json={'body': '科目を選び、空きコマを指定してください。'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['status'], 'answered')
        self.assertTrue(response.json['messages'][-1]['is_admin'])
        self.assertEqual(len(self.client.get('/api/me/support/' + ticket_id).json['messages']), 2)
        self.assertEqual(other.put('/api/me/support/' + ticket_id, headers=self.headers(other_me), json={'status': 'closed'}).status_code, 200)

    def test_usage_aggregates_deduplicate_and_exclude_private_contents(self):
        me = self.register()
        for _ in range(2):
            self.assertEqual(self.client.post('/api/me/events', headers=self.headers(me), json={'page': 'timetable'}).status_code, 200)
        self.assertEqual(self.client.post('/api/me/events', headers=self.headers(me), json={'page': 'password:secret'}).status_code, 400)
        with connect() as db:
            db.execute('INSERT INTO admin_members VALUES (?,?)', (me['id'], int(time.time())))
        response = self.client.get('/api/me/admin/analytics?days=7')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['registeredUsers'], 1)
        self.assertEqual(response.json['activeUsers'], 1)
        self.assertEqual(response.json['pages'], [{'page': 'timetable', 'users': 1, 'views': 1}])
        self.assertNotIn('password', response.get_data(as_text=True))
        self.assertNotIn(me['username'], response.get_data(as_text=True))

    def test_support_input_and_csrf_validation(self):
        me = self.register()
        self.assertEqual(self.client.post('/api/me/support', headers=HEADERS, json={'subject': 'x', 'body': 'y'}).status_code, 403)
        for data in [{'subject': '', 'body': 'x'}, {'subject': 'x', 'body': 'x' * 5001}]:
            self.assertEqual(self.client.post('/api/me/support', headers=self.headers(me), json=data).status_code, 400)
