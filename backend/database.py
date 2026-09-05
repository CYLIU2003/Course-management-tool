"""Transactional reference imports and SQLite backup; students survive re-import."""
import argparse
import hashlib
import json
import os
import re
import unicodedata
from contextlib import contextmanager, closing
from pathlib import Path
import sqlite3
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / 'data/curriculum.sqlite3'


def database_path():
    return Path(os.environ.get('CURRICULUM_DB_PATH', DEFAULT_DB)).resolve()


@contextmanager
def connect(path=None):
    connection = sqlite3.connect(path or database_path(), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    connection.execute('PRAGMA busy_timeout=10000')
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(path=None):
    path = Path(path or database_path())
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as connection:
        version = connection.execute('PRAGMA user_version').fetchone()[0]
        if version not in (0, 1, 2, 3):
            raise ValueError(f'Unsupported database schema version: {version}')
        connection.execute('PRAGMA journal_mode=WAL')
        connection.executescript(Path(__file__).with_name('schema.sql').read_text(encoding='utf-8'))


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate_course_evidence(course, bundle, department, records):
    prefix = f"reference-{department['id']}-"
    record = records.get(course['id'].removeprefix(prefix)) if course['id'].startswith(prefix) else None
    if not record:
        raise ValueError('Course has no PDF source record')
    original, source = record
    evidence = original.get('verification', {})
    scopes = {department['faculty'], re.sub('（.*?）', '', department['name']), '共通分野'}
    if department['id'] == 'ningen' and bundle['entranceYear'] == 2022:
        scopes.add('児童学科')
    if (evidence.get('status') != 'pdf_position_checked' or evidence.get('sourceSha256') != source['sha256']
            or evidence.get('scope') not in scopes or source['year'] != bundle['entranceYear']
            or source['faculty'] != department['faculty'] or course['title'] != evidence.get('titleText')
            or course['credits'] != original['credits'] or course['courseType'] != 'unknown'):
        raise ValueError('Course PDF evidence or applicability mismatch')


def import_reference_data(path=None):
    initialize(path)
    base = ROOT / 'public/handbooks'
    catalog = read_json(base / 'catalog.json')
    programs = read_json(base / 'hirameki-programs.json')['programs']
    bundles = read_json(ROOT / 'data/import/curricula.json')
    for item in bundles['inputs']:
        source_path = (ROOT / item['path']).resolve()
        if not source_path.is_relative_to(ROOT) or hashlib.sha256(source_path.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError(f"Stale curriculum import input: {item['path']}")
    if len(bundles['datasets']) != 95:
        raise ValueError('Expected 95 department/cohort combinations (including one unavailable)')
    with connect(path) as connection:
        connection.execute('BEGIN IMMEDIATE')
        # Import replaces official reference data atomically, never student data.
        connection.execute('DELETE FROM programs')
        connection.execute('DELETE FROM source_documents')
        faq = read_json(base / 'tap-faq.json')
        if hashlib.sha256((base / 'tap-faq.html').read_bytes()).hexdigest() != faq['sha256']:
            raise ValueError('TAP FAQ hash mismatch')
        connection.execute('INSERT INTO web_evidence VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,sha256=excluded.sha256,record_json=excluded.record_json', (faq['id'], faq['url'], faq['sha256'], encode(faq)))
        departments = {row['id']: row for row in bundles['departments']}
        records = {}
        for row in departments.values():
            connection.execute('INSERT INTO faculties VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name', (row['facultyId'], row['faculty']))
            connection.execute('INSERT INTO departments VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET faculty_id=excluded.faculty_id,name=excluded.name',
                               (row['id'], row['facultyId'], row['name']))
        for source in catalog['documents']:
            data = read_json(ROOT / 'public' / source['dataPath'].lstrip('/'))
            pdf = ROOT / 'public' / source['localPath'].lstrip('/')
            if hashlib.sha256(pdf.read_bytes()).hexdigest() != source['sha256'] or data['sha256'] != source['sha256']:
                raise ValueError(f"Source hash mismatch: {source['id']}")
            if len(data['pages']) != source['pageCount'] or len(data['courses']) != source['courseCount']:
                raise ValueError(f"Stale extraction catalog: {source['id']}")
            metadata = dict(source, issues=data['issues'], unicodeRepairs=data.get('unicodeRepairs', []))
            connection.execute('INSERT INTO source_documents VALUES (?,?,?,?,?,?,?,?,?,?)',
                               (source['id'], source['kind'], source['year'], source['faculty'], source['label'],
                                source['url'], source['localPath'], source['sha256'], source['pageCount'], encode(metadata)))
            for page in data['pages']:
                topics = list(page['topics'])
                if any(word in page['text'] for word in ['教職', '教育職員免許', '教育実習', '教員免許']):
                    topics.append('teacher')
                normalized = unicodedata.normalize('NFKC', page['text'])
                if re.search(r'(?<![A-Za-z])A?TAP(?![A-Za-z])', normalized, re.I) or 'オーストラリアプログラム' in normalized:
                    topics.append('tap')
                topics = list(dict.fromkeys(topics))
                connection.execute('INSERT INTO source_pages VALUES (?,?,?,?)', (source['id'], page['page'], page['text'], encode(topics)))
                for table in page['tables']:
                    connection.execute('INSERT INTO source_tables VALUES (?,?,?,?,?)',
                                       (source['id'], page['page'], table['index'], encode(table['rows']), encode(table['bbox'])))
                for topic in topics:
                    if topic != 'curriculum':
                        connection.execute('INSERT INTO requirement_evidence(source_id,page_number,requirement_kind) VALUES (?,?,?)', (source['id'], page['page'], topic))
            for course in data['courses']:
                records[course['id']] = (course, source)
                connection.execute('INSERT INTO course_records VALUES (?,?,?,?,?,?,?,?,?)',
                                   (course['id'], source['id'], course['page'], course['title'], course['credits'],
                                    course['category'], course['rawRequired'], course['status'], encode(course)))
        for program in programs:
            connection.execute('INSERT INTO programs VALUES (?,?,?,?,?)', (program['id'], program['sourceId'], program['title'], program['totalCredits'], encode(program)))
            for position, group in enumerate(program['groups']):
                connection.execute('INSERT INTO program_groups VALUES (?,?,?,?,?)', (program['id'], position, group['name'], group['credits'], group.get('note')))
            for position, course in enumerate(program['courses']):
                connection.execute('INSERT INTO program_courses VALUES (?,?,?,?)', (program['id'], position, course['title'], course['credits']))
        connection.execute('DELETE FROM cohort_datasets')
        for bundle in bundles['datasets']:
            if any(course.get('departmentId') != bundle['departmentId'] or course.get('curriculumYear') != bundle['entranceYear'] for course in bundle['courses']):
                raise ValueError('Course cohort mismatch')
            for course in bundle['courses']:
                validate_course_evidence(course, bundle, departments[bundle['departmentId']], records)
            connection.execute('INSERT INTO cohort_datasets VALUES (?,?,?,?,?)',
                               (bundle['departmentId'], bundle['entranceYear'], bundle['status'], len(bundle['courses']), encode(bundle)))
        connection.execute('DELETE FROM academic_calendars')
        for calendar_path in (ROOT / 'public/academic-calendar').glob('*.json'):
            calendar = read_json(calendar_path)
            connection.execute('INSERT INTO academic_calendars VALUES (?,?)', (int(calendar_path.stem), encode(calendar)))
        for key, value in {'retrievedAt': catalog['retrievedAt'], 'importedAt': datetime.now(timezone.utc).isoformat(),
                           'catalogSha256': hashlib.sha256((base / 'catalog.json').read_bytes()).hexdigest()}.items():
            connection.execute('INSERT INTO dataset_meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, value))
        if connection.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Foreign key validation failed')
    return database_health(path)


def database_health(path=None):
    with connect(path) as connection:
        return dict(schemaVersion=connection.execute('PRAGMA user_version').fetchone()[0],
                    integrity=connection.execute('PRAGMA quick_check').fetchone()[0],
                    counts={table: connection.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                            for table in ['source_documents', 'source_pages', 'source_tables', 'course_records', 'requirement_evidence', 'programs', 'student_profiles', 'cohort_datasets']})


def backup_database(destination, path=None):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Backup destination already exists; choose a new filename')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as source, closing(sqlite3.connect(destination)) as target:
        source.backup(target)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--import', dest='import_data', action='store_true')
    parser.add_argument('--backup', type=Path)
    arguments = parser.parse_args()
    if arguments.import_data:
        print(encode(import_reference_data()))
    elif arguments.backup:
        backup_database(arguments.backup)
        print(f'Backup created: {arguments.backup}')
    else:
        print(encode(database_health()))
