"""Owner-scoped support threads and aggregate usage. No passwords/grades in analytics."""
import time
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from .database import connect

blueprint = Blueprint('administration', __name__)


def text_field(data, key, limit):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f'{key} は1〜{limit}文字で入力してください。')
    return value.strip()


def read_ticket(connection, ticket_id):
    row = connection.execute('SELECT t.*, a.username FROM support_tickets t JOIN accounts a ON a.id=t.account_id WHERE t.id=?', (ticket_id,)).fetchone()
    if row is None or (not g.account['is_admin'] and row['account_id'] != g.account['account_id']):
        return None
    messages = [dict(item) for item in connection.execute('SELECT id,is_admin,body,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at,rowid', (ticket_id,))]
    return dict(row, messages=messages)


@blueprint.post('/api/me/events')
def event():
    data = request.get_json()
    if not isinstance(data, dict) or data.get('page') not in {'home', 'timetable', 'grades', 'handbooks', 'settings', 'requirements'}:
        raise ValueError('Invalid event')
    now = int(time.time())
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        # Keep a bounded 90-day history; events carry only page names.
        db.execute('DELETE FROM usage_events WHERE created_at<?', (now - 90 * 86400,))
        recent = db.execute('SELECT 1 FROM usage_events WHERE account_id=? AND event_name=? AND created_at>?', (g.account['account_id'], data['page'], now - 10)).fetchone()
        if not recent:
            db.execute('INSERT INTO usage_events VALUES (?,?,?,?)', (str(uuid4()), g.account['account_id'], data['page'], now))
    return jsonify(ok=True)


@blueprint.route('/api/me/support', methods=['GET', 'POST'])
def tickets():
    with connect() as db:
        if request.method == 'GET':
            rows = db.execute('SELECT id,subject,status,created_at,updated_at FROM support_tickets WHERE account_id=? ORDER BY updated_at DESC LIMIT 100', (g.account['account_id'],))
            return jsonify([dict(row) for row in rows])
        data = request.get_json()
        if not isinstance(data, dict):
            raise ValueError('Invalid ticket')
        subject, message = text_field(data, 'subject', 120), text_field(data, 'body', 5000)
        now, ticket_id = int(time.time()), str(uuid4())
        db.execute('BEGIN IMMEDIATE')
        count = db.execute('SELECT count(*) FROM support_tickets WHERE account_id=? AND created_at>?', (g.account['account_id'], now - 3600)).fetchone()[0]
        if count >= 10:
            return jsonify(error='送信が多いため、時間を置いてお試しください。'), 429
        db.execute('INSERT INTO support_tickets VALUES (?,?,?,?,?,?)', (ticket_id, g.account['account_id'], subject, 'open', now, now))
        db.execute('INSERT INTO support_messages VALUES (?,?,?,?,?,?)', (str(uuid4()), ticket_id, g.account['account_id'], 0, message, now))
        return jsonify(read_ticket(db, ticket_id)), 201


@blueprint.route('/api/me/support/<ticket_id>', methods=['GET', 'POST', 'PUT'])
def thread(ticket_id):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE' if request.method != 'GET' else 'BEGIN')
        ticket = read_ticket(db, ticket_id)
        if ticket is None:
            return jsonify(error='問い合わせが見つかりません。'), 404
        if request.method == 'GET':
            return jsonify(ticket)
        data = request.get_json()
        if not isinstance(data, dict):
            raise ValueError('Invalid request')
        now = int(time.time())
        if request.method == 'PUT':
            if not g.account['is_admin']:
                return jsonify(error='管理者権限が必要です。'), 403
            if data.get('status') not in {'open', 'answered', 'closed'}:
                raise ValueError('Invalid status')
            status = data['status']
        else:
            message = text_field(data, 'body', 5000)
            count = db.execute('SELECT count(*) FROM support_messages WHERE author_id=? AND created_at>?', (g.account['account_id'], now - 3600)).fetchone()[0]
            if count >= 60:
                return jsonify(error='送信が多いため、時間を置いてお試しください。'), 429
            db.execute('INSERT INTO support_messages VALUES (?,?,?,?,?,?)', (str(uuid4()), ticket_id, g.account['account_id'], int(g.account['is_admin']), message, now))
            status = 'answered' if g.account['is_admin'] else 'open'
        db.execute('UPDATE support_tickets SET status=?,updated_at=? WHERE id=?', (status, now, ticket_id))
        return jsonify(read_ticket(db, ticket_id))


@blueprint.get('/api/me/admin/support')
def admin_tickets():
    with connect() as db:
        rows = db.execute('SELECT t.id,t.subject,t.status,t.created_at,t.updated_at,a.username FROM support_tickets t JOIN accounts a ON a.id=t.account_id ORDER BY t.updated_at DESC LIMIT 200')
        return jsonify([dict(row) for row in rows])


@blueprint.get('/api/me/admin/analytics')
def analytics():
    try:
        days = int(request.args.get('days', '30'))
    except ValueError:
        raise ValueError('Invalid period') from None
    if days not in (7, 30, 90):
        raise ValueError('Invalid period')
    cutoff = int(time.time()) - days * 86400
    with connect() as db:
        users = db.execute('SELECT count(*) FROM accounts').fetchone()[0]
        active = db.execute('SELECT count(DISTINCT account_id) FROM usage_events WHERE created_at>=?', (cutoff,)).fetchone()[0]
        views = [dict(row) for row in db.execute('SELECT event_name AS page,count(*) AS views,count(DISTINCT account_id) AS users FROM usage_events WHERE created_at>=? GROUP BY event_name ORDER BY views DESC', (cutoff,))]
        daily = [dict(row) for row in db.execute("SELECT date(created_at,'unixepoch','+9 hours') AS day,count(*) AS views,count(DISTINCT account_id) AS users FROM usage_events WHERE created_at>=? GROUP BY day ORDER BY day", (cutoff,))]
        cohorts = [dict(row) for row in db.execute('SELECT d.name AS department,a.entrance_year AS year,count(*) AS users FROM accounts a JOIN departments d ON d.id=a.department_id GROUP BY a.department_id,a.entrance_year ORDER BY users DESC')]
        support = [dict(row) for row in db.execute('SELECT status,count(*) AS count FROM support_tickets GROUP BY status')]
    return jsonify(days=days, registeredUsers=users, activeUsers=active, pages=views, daily=daily, cohorts=cohorts, support=support)
