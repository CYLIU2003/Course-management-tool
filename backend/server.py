"""Profile/document repositories and the production server entry point."""
import argparse
import json
import sqlite3
from datetime import datetime, timezone
from uuid import UUID



def read_document(connection, source_id):
    row = connection.execute('SELECT metadata_json FROM source_documents WHERE id=?', (source_id,)).fetchone()
    if row is None:
        return None
    document = json.loads(row[0])
    tables = {}
    for row in connection.execute('SELECT * FROM source_tables WHERE source_id=? ORDER BY page_number,table_index', (source_id,)):
        tables.setdefault(row['page_number'], []).append(dict(index=row['table_index'], rows=json.loads(row['rows_json']), bbox=json.loads(row['bbox_json'])))
    document['pages'] = [dict(page=row['page_number'], text=row['text'], hasText=bool(row['text'].strip()), topics=json.loads(row['topics_json']), tables=tables.get(row['page_number'], []))
                         for row in connection.execute('SELECT * FROM source_pages WHERE source_id=? ORDER BY page_number', (source_id,))]
    document['courses'] = [json.loads(row[0]) for row in connection.execute('SELECT record_json FROM course_records WHERE source_id=? ORDER BY page_number,id', (source_id,))]
    return document


def save_profile(connection, profile_id, data):
    UUID(profile_id)
    if set(data) != {'departmentId', 'entranceYear', 'isGeneral', 'takesTeacher', 'takesHirameki', 'takesTap', 'individualNote', 'revision'}:
        raise ValueError('Invalid profile fields')
    if any(type(data[key]) is not bool for key in ['isGeneral', 'takesTeacher', 'takesHirameki', 'takesTap']) or not data['isGeneral']:
        raise ValueError('Profile choices must be booleans')
    if type(data['entranceYear']) is not int or not 2022 <= data['entranceYear'] <= 2100:
        raise ValueError('Invalid entrance year')
    if type(data['revision']) is not int or data['revision'] < 0 or not isinstance(data['individualNote'], str) or len(data['individualNote']) > 1000:
        raise ValueError('Invalid revision or note')
    if not isinstance(data['departmentId'], str) or not connection.execute('SELECT 1 FROM departments WHERE id=?', (data['departmentId'],)).fetchone():
        raise ValueError('Unknown department')
    connection.execute('BEGIN IMMEDIATE')
    old = connection.execute('SELECT revision FROM student_profiles WHERE id=?', (profile_id,)).fetchone()
    if data['revision'] != (old[0] if old else 0):
        raise FileExistsError('Profile changed elsewhere. Reload before saving.')
    values = (profile_id, data['departmentId'], data['entranceYear'], True, data['takesTeacher'], data['takesHirameki'], data['takesTap'], data['individualNote'], data['revision'] + 1, datetime.now(timezone.utc).isoformat())
    connection.execute('INSERT INTO student_profiles(id,department_id,entrance_year,is_general,takes_teacher,takes_hirameki,takes_tap,individual_note,revision,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET department_id=excluded.department_id,entrance_year=excluded.entrance_year,is_general=excluded.is_general,takes_teacher=excluded.takes_teacher,takes_hirameki=excluded.takes_hirameki,takes_tap=excluded.takes_tap,individual_note=excluded.individual_note,revision=excluded.revision,updated_at=excluded.updated_at', values)
    return dict(data, revision=data['revision'] + 1)


def read_profile(connection, profile_id):
    UUID(profile_id)
    row = connection.execute('SELECT * FROM student_profiles WHERE id=?', (profile_id,)).fetchone()
    return None if row is None else dict(departmentId=row['department_id'], entranceYear=row['entrance_year'], isGeneral=bool(row['is_general']), takesTeacher=bool(row['takes_teacher']), takesHirameki=bool(row['takes_hirameki']), takesTap=bool(row['takes_tap']), individualNote=row['individual_note'], revision=row['revision'])


if __name__ == '__main__':
    from .web import run
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    run(parser.parse_args().port)
