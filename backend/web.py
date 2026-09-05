"""Same-origin web application. Waitress behind HTTPS with a persistent SQLite volume."""
import json
import os
import secrets
import sqlite3
import time
from urllib.parse import urlparse
from uuid import uuid4

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from .accounts import (PASSWORDS, SESSION_SECONDS, check_password, consume_attempts, digest,
                       new_session, validate_cohort, validate_credentials, validate_state)
from .database import ROOT, connect, database_health, initialize
from .server import read_document, read_profile, save_profile
from .administration import blueprint as administration
from . import offerings


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.register_blueprint(administration)
    origin = os.environ.get('PUBLIC_ORIGIN', '').rstrip('/')
    if origin and (urlparse(origin).scheme != 'https' or not urlparse(origin).hostname or urlparse(origin).path):
        raise ValueError('PUBLIC_ORIGIN must be an HTTPS origin without a path')
    origins = {origin} if origin else {f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (5173, 4173, 8000)}
    app.config.update(MAX_CONTENT_LENGTH=1024 * 1024, PUBLIC_ORIGIN=origin, ALLOWED_ORIGINS=origins,
                      TRUSTED_HOSTS=[urlparse(origin).hostname] if origin else ['localhost', '127.0.0.1', '[::1]'])
    if config:
        app.config.update(config)
    cookie = '__Host-campus_session' if app.config['PUBLIC_ORIGIN'] else 'campus_session'

    def fail(message, code):
        return jsonify(error=message), code

    def body():
        value = request.get_json()
        if not isinstance(value, dict):
            raise ValueError('JSONオブジェクトが必要です。')
        return value

    @app.before_request
    def guard():
        # Flask runs before_request even when routing rejected an untrusted Host.
        if request.routing_exception and request.routing_exception.code == 400:
            raise request.routing_exception
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.headers.get('Origin') not in app.config['ALLOWED_ORIGINS'] or request.headers.get('X-Campus-Request') != '1':
                return fail('この画面からの操作を確認できません。再読み込みしてください。', 403)
        if request.path.startswith('/api/me'):
            with connect() as connection:
                row = connection.execute('SELECT s.*,a.username,a.department_id,a.entrance_year FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE token_hash=? AND expires_at>?', (digest(request.cookies.get(cookie, '')), int(time.time()))).fetchone()
            if row is None:
                return fail('ログインしてください。', 401)
            g.account = dict(row)
            with connect() as connection:
                g.account['is_admin'] = bool(connection.execute('SELECT 1 FROM admin_members WHERE account_id=?', (row['account_id'],)).fetchone())
            if request.path.startswith('/api/me/admin/') and not g.account['is_admin']:
                return fail('管理者権限が必要です。', 403)
            if request.method not in ('GET', 'HEAD') and not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), row['csrf_token']):
                return fail('ログイン情報が変更されています。再読み込みしてください。', 403)

    @app.after_request
    def secure_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        if app.config['PUBLIC_ORIGIN']:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        return response

    @app.errorhandler(ValueError)
    def invalid(error):
        return fail(str(error), 400)

    @app.errorhandler(FileExistsError)
    def conflict(error):
        return fail('別の画面で更新されています。保存内容を確認して再読み込みしてください。', 409)

    @app.errorhandler(sqlite3.Error)
    def unavailable(error):
        app.logger.error('SQLite request failed: %s', type(error).__name__)
        return fail('現在保存先に接続できません。時間を置いて再試行してください。', 503)

    @app.errorhandler(HTTPException)
    def http_error(error):
        return fail('リクエストを処理できませんでした。', error.code)

    @app.get('/api/registration-options')
    def options():
        with connect() as connection:
            return jsonify([dict(row) for row in connection.execute('SELECT d.id,d.name,f.name AS faculty,c.entrance_year AS entranceYear,c.status FROM departments d JOIN faculties f ON f.id=d.faculty_id JOIN cohort_datasets c ON c.department_id=d.id ORDER BY f.id,d.id,c.entrance_year')])

    @app.post('/api/auth/<action>')
    def authenticate(action):
        if action not in ('register', 'login'):
            return fail('見つかりません。', 404)
        data = body()
        username, password = validate_credentials(data)
        with connect() as connection:
            buckets = [('ip:' + digest(request.remote_addr or ''), 60), ('name:' + digest(username), 15)]
            if not consume_attempts(connection, buckets):
                response = jsonify(error='試行回数が多いため、10分後にお試しください。')
                response.status_code = 429
                response.headers['Retry-After'] = '600'
                return response
            if action == 'register':
                validate_cohort(connection, data)
                encoded = PASSWORDS.hash(password)
                account_id = str(uuid4())
                try:
                    connection.execute('INSERT INTO accounts VALUES (?,?,?,?,?,?)', (account_id, username, encoded, data['departmentId'], data['entranceYear'], int(time.time())))
                except sqlite3.IntegrityError:
                    return fail('このユーザー名は利用できません。', 409)
            else:
                row = connection.execute('SELECT * FROM accounts WHERE username=?', (username,)).fetchone()
                if not check_password(row['password_hash'] if row else None, password) or row is None:
                    return fail('ユーザー名またはパスワードが違います。', 401)
                account_id = row['id']
                if PASSWORDS.check_needs_rehash(row['password_hash']):
                    connection.execute('UPDATE accounts SET password_hash=? WHERE id=?', (PASSWORDS.hash(password), account_id))
            connection.execute('DELETE FROM account_sessions WHERE token_hash=?', (digest(request.cookies.get(cookie, '')),))
            token, _ = new_session(connection, account_id)
        response = jsonify(ok=True)
        response.set_cookie(cookie, token, max_age=SESSION_SECONDS, secure=bool(app.config['PUBLIC_ORIGIN']), httponly=True, samesite='Lax', path='/')
        return response

    @app.get('/api/me')
    def me():
        with connect() as connection:
            row = connection.execute('SELECT * FROM account_state WHERE account_id=?', (g.account['account_id'],)).fetchone()
        return jsonify(id=g.account['account_id'], username=g.account['username'], departmentId=g.account['department_id'], entranceYear=g.account['entrance_year'], isAdmin=g.account['is_admin'], csrfToken=g.account['csrf_token'], state=json.loads(row['payload_json']) if row else None, revision=row['revision'] if row else 0)

    @app.post('/api/me/logout')
    def logout():
        with connect() as connection:
            connection.execute('DELETE FROM account_sessions WHERE token_hash=?', (g.account['token_hash'],))
        response = jsonify(ok=True)
        response.delete_cookie(cookie, path='/', secure=bool(app.config['PUBLIC_ORIGIN']), httponly=True, samesite='Lax')
        return response

    @app.put('/api/me/state')
    def save_state():
        data = body()
        if set(data) != {'state', 'revision'} or not isinstance(data['state'], dict) or type(data['revision']) is not int or data['revision'] < 0:
            raise ValueError('保存リクエストが不正です。')
        state = data['state']
        validate_state(state)
        with connect() as connection:
            validate_cohort(connection, state)
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT revision FROM account_state WHERE account_id=?', (g.account['account_id'],)).fetchone()
            if data['revision'] != (row[0] if row else 0):
                raise FileExistsError()
            revision = data['revision'] + 1
            connection.execute('INSERT INTO account_state VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET payload_json=excluded.payload_json,revision=excluded.revision,updated_at=excluded.updated_at', (g.account['account_id'], json.dumps(state, ensure_ascii=False, allow_nan=False), revision, int(time.time())))
            connection.execute('UPDATE accounts SET department_id=?,entrance_year=? WHERE id=?', (state['departmentId'], state['entranceYear'], g.account['account_id']))
        return jsonify(revision=revision)

    @app.post('/api/me/validate-state')
    def validate_import():
        data = body()
        validate_state(data)
        with connect() as connection:
            validate_cohort(connection, data)
        return jsonify(ok=True)

    @app.route('/api/me/profile', methods=['GET', 'PUT'])
    def profile():
        with connect() as connection:
            if request.method == 'GET':
                result = read_profile(connection, g.account['account_id'])
            else:
                data = body()
                validate_cohort(connection, data)
                result = save_profile(connection, g.account['account_id'], data)
        return jsonify(result)

    @app.get('/api/health')
    def health():
        return jsonify(database_health())

    @app.get('/api/offerings/<int:year>')
    def offering_catalog(year):
        with connect() as connection:
            return jsonify(offerings.catalog(connection,year))

    @app.get('/api/offerings/<int:year>/audit')
    def offering_audit(year):
        with connect() as connection:
            result=offerings.audit(connection,year)
        return jsonify(result) if result else fail('開講資料が未登録です。',404)

    @app.get('/api/curricula/<department>/<int:year>')
    def curriculum(department, year):
        with connect() as connection:
            row = connection.execute('SELECT payload_json FROM cohort_datasets WHERE department_id=? AND entrance_year=?', (department, year)).fetchone()
        return jsonify(json.loads(row[0])) if row else fail('見つかりません。', 404)

    @app.get('/api/academic-calendar/<int:year>')
    def calendar(year):
        with connect() as connection:
            row = connection.execute('SELECT payload_json FROM academic_calendars WHERE academic_year=?', (year,)).fetchone()
        return jsonify(json.loads(row[0])) if row else fail('見つかりません。', 404)

    @app.get('/api/handbooks/catalog')
    def catalog():
        with connect() as connection:
            return jsonify(schemaVersion=1, retrievedAt=connection.execute("SELECT value FROM dataset_meta WHERE key='retrievedAt'").fetchone()[0], documents=[json.loads(row[0]) for row in connection.execute('SELECT metadata_json FROM source_documents ORDER BY entrance_year,id')])

    @app.get('/api/handbooks/documents/<source_id>')
    def document(source_id):
        with connect() as connection:
            result = read_document(connection, source_id)
        return jsonify(result) if result else fail('見つかりません。', 404)

    @app.get('/api/hirameki/programs')
    def programs():
        with connect() as connection:
            return jsonify(schemaVersion=1, programs=[json.loads(row[0]) for row in connection.execute('SELECT record_json FROM programs ORDER BY id')])

    @app.get('/api/tap/faq')
    def faq():
        with connect() as connection:
            return jsonify(json.loads(connection.execute("SELECT record_json FROM web_evidence WHERE id='tap-faq'").fetchone()[0]))

    @app.get('/')
    def index():
        return send_from_directory(ROOT / 'dist', 'index.html')

    @app.get('/<path:path>')
    def static_file(path):
        if path.startswith('api/'):
            return fail('見つかりません。', 404)
        return send_from_directory(ROOT / 'dist', path)

    return app


def run(port=8000):
    from waitress import serve
    initialize()
    if not database_health()['counts']['source_documents']:
        raise SystemExit('Reference data missing. Run npm run db:build first.')
    app = create_app()
    host = '0.0.0.0' if app.config['PUBLIC_ORIGIN'] else '127.0.0.1'
    print(f'Campus Note: {app.config["PUBLIC_ORIGIN"] or f"http://{host}:{port}"}', flush=True)
    serve(app, host=host, port=port, threads=4, max_request_body_size=1024 * 1024)
