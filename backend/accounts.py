"""Account validation and opaque, revocable SQLite sessions."""
import hashlib
import re
import secrets
import time

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

PASSWORDS = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)
DUMMY_HASH = PASSWORDS.hash(secrets.token_urlsafe(32))
SESSION_SECONDS = 7 * 24 * 3600


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def check_password(encoded, password):
    try:
        return PASSWORDS.verify(encoded or DUMMY_HASH, password)
    except VerificationError:
        return False


def validate_credentials(data):
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,32}', username):
        raise ValueError('ユーザー名は半角英数字・_・- の3〜32文字で入力してください。')
    if not isinstance(password, str) or not 12 <= len(password) <= 128:
        raise ValueError('パスワードは12〜128文字で入力してください。')
    return username.lower(), password


def validate_cohort(connection, data):
    department, year = data.get('departmentId'), data.get('entranceYear')
    if not isinstance(department, str) or type(year) is not int:
        raise ValueError('学科と入学年度を選択してください。')
    if not connection.execute('SELECT 1 FROM cohort_datasets WHERE department_id=? AND entrance_year=?', (department, year)).fetchone():
        raise ValueError('対応する学科・入学年度を選択してください。')


def consume_attempts(connection, buckets):
    """Commit attempts even when authentication fails; bound password-hash work."""
    now = int(time.time())
    connection.execute('BEGIN IMMEDIATE')
    connection.execute('DELETE FROM auth_attempts WHERE resets_at<=?', (now,))
    for bucket, limit in buckets:
        row = connection.execute('SELECT attempts FROM auth_attempts WHERE bucket=?', (bucket,)).fetchone()
        if row and row[0] >= limit:
            connection.commit()
            return False
    for bucket, _ in buckets:
        connection.execute('INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1', (bucket, now + 600))
    connection.commit()
    return True


def new_session(connection, account_id):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    now = int(time.time())
    connection.execute('DELETE FROM account_sessions WHERE expires_at<=?', (now,))
    connection.execute('INSERT INTO account_sessions VALUES (?,?,?,?)', (digest(token), account_id, csrf, now + SESSION_SECONDS))
    return token, csrf


def validate_state(data):
    """Validate the shapes the renderer consumes; curriculum never comes from user data."""
    if set(data) != {'departmentId', 'entranceYear', 'settings', 'allYearsData'}:
        raise ValueError('保存データの項目が不正です。')
    settings = data['settings']
    if not isinstance(settings, dict) or set(settings) != {'title', 'days', 'periods', 'showTime'}:
        raise ValueError('時間割設定が不正です。')
    if not isinstance(settings['title'], str) or len(settings['title']) > 200 or type(settings['showTime']) is not bool:
        raise ValueError('時間割設定が不正です。')
    days = settings['days']
    if not isinstance(days, list) or not 1 <= len(days) <= 7 or any(not isinstance(d, str) or not 1 <= len(d) <= 10 for d in days) or len(set(days)) != len(days):
        raise ValueError('曜日設定が不正です。')
    periods = settings['periods']
    if not isinstance(periods, list) or not 1 <= len(periods) <= 20:
        raise ValueError('時限設定が不正です。')
    ids = set()
    for period in periods:
        if not isinstance(period, dict) or set(period) != {'id', 'label', 'time'} or type(period['id']) is not int or not 1 <= period['id'] <= 99 or period['id'] in ids:
            raise ValueError('時限設定が不正です。')
        ids.add(period['id'])
        if any(not isinstance(period[k], str) or len(period[k]) > 100 for k in ('label', 'time')):
            raise ValueError('時限設定が不正です。')
    years = data['allYearsData']
    if not isinstance(years, dict) or set(years) != {'1年次', '2年次', '3年次', '4年次', 'M1', 'M2'}:
        raise ValueError('学年データが不正です。')
    for year in years.values():
        if not isinstance(year, dict) or set(year) != {'timetable', 'quarterRanges'}:
            raise ValueError('時間割データが不正です。')
        ranges = year['quarterRanges']
        if not isinstance(ranges, dict) or set(ranges) != {'1Q', '2Q', '3Q', '4Q'}:
            raise ValueError('学期設定が不正です。')
        for dates in ranges.values():
            if not isinstance(dates, dict) or set(dates) != {'start', 'end'} or any(not isinstance(v, str) or len(v) > 10 for v in dates.values()):
                raise ValueError('学期設定が不正です。')
        timetable = year['timetable']
        if not isinstance(timetable, dict) or not set(timetable) <= set(ranges):
            raise ValueError('時間割データが不正です。')
        for quarter in timetable.values():
            if not isinstance(quarter, dict) or len(quarter) > 7:
                raise ValueError('時間割データが不正です。')
            for day, cells in quarter.items():
                if len(day) > 10 or not isinstance(cells, dict) or len(cells) > 20:
                    raise ValueError('時間割データが不正です。')
                for period, cell in cells.items():
                    if not period.isdigit() or not 1 <= int(period) <= 99:
                        raise ValueError('時限が不正です。')
                    if cell is None:
                        continue
                    if not isinstance(cell, dict) or not isinstance(cell.get('title'), str) or len(cell['title']) > 300:
                        raise ValueError('科目データが不正です。')
                    for key, value in cell.items():
                        if key == 'credits':
                            if type(value) not in (int, float) or not 0 < value <= 20:
                                raise ValueError('単位数が不正です。')
                        elif key == 'sourceOffering':
                            if not isinstance(value, dict) or any(not isinstance(v, (str, int, float)) for v in value.values()):
                                raise ValueError('開講情報が不正です。')
                        elif not isinstance(value, str) or len(value) > 5000:
                            raise ValueError('科目データが不正です。')
                    if cell.get('grade', '未履修') not in ('秀', '優', '良', '可', '不可', '未履修'):
                        raise ValueError('成績が不正です。')
