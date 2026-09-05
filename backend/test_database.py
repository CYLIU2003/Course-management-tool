"""Exercise persistence, all optional-program combinations and original evidence."""
import itertools
import json
from pathlib import Path
import tempfile
import unittest
import os
import threading
from urllib.request import urlopen, Request
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from uuid import uuid4

from .database import ROOT, connect, import_reference_data, database_health, backup_database, read_json, validate_course_evidence
from .server import Handler, save_profile, read_profile, read_document


class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.path = Path(cls.directory.name) / 'test.sqlite3'
        cls.health = import_reference_data(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def profile(self, **changes):
        return dict(departmentId='kikai', entranceYear=2022, isGeneral=True, takesTeacher=False, takesHirameki=False, takesTap=False, individualNote='', revision=0, **changes)

    def test_all_eight_combinations_round_trip(self):
        for teacher, hirameki, tap in itertools.product([False, True], repeat=3):
            profile_id = str(uuid4())
            value = self.profile()
            value.update(takesTeacher=teacher, takesHirameki=hirameki, takesTap=tap)
            with connect(self.path) as connection:
                saved = save_profile(connection, profile_id, value)
            with connect(self.path) as connection:
                self.assertEqual(saved, read_profile(connection, profile_id))

    def test_conflict_and_boolean_validation(self):
        profile_id = str(uuid4())
        value = self.profile()
        with connect(self.path) as connection:
            save_profile(connection, profile_id, value)
        with self.assertRaises(FileExistsError), connect(self.path) as connection:
            save_profile(connection, profile_id, value)
        value['takesTap'] = 'false'
        with self.assertRaises(ValueError), connect(self.path) as connection:
            save_profile(connection, str(uuid4()), value)

    def test_runtime_course_rejects_changed_title_credit_year_and_department(self):
        bundles = read_json(ROOT / 'data/import/curricula.json')
        bundle = next(b for b in bundles['datasets'] if b['departmentId'] == 'kankyo_sosei' and b['entranceYear'] == 2024)
        department = next(d for d in bundles['departments'] if d['id'] == bundle['departmentId'])
        course = next(c for c in bundle['courses'] if c['title'] == '環境マネジメントシステム')
        source_id = course['id'].removeprefix('reference-kankyo_sosei-')
        with connect(self.path) as connection:
            row = connection.execute('SELECT c.record_json, d.metadata_json FROM course_records c JOIN source_documents d ON d.id=c.source_id WHERE c.id=?', (source_id,)).fetchone()
        records = {source_id: (json.loads(row[0]), json.loads(row[1]))}
        validate_course_evidence(course, bundle, department, records)
        for changes in [{'title': '間違った科目'}, {'credits': 20}]:
            with self.assertRaises(ValueError):
                validate_course_evidence(dict(course, **changes), bundle, department, records)
        with self.assertRaises(ValueError):
            validate_course_evidence(course, dict(bundle, entranceYear=2025), department, records)
        other = next(d for d in bundles['departments'] if d['id'] == 'kankyo_keiei')
        with self.assertRaises(ValueError):
            validate_course_evidence(dict(course, id='reference-kankyo_keiei-' + source_id), bundle, other, records)

    def test_source_counts_and_tap_each_year(self):
        self.assertEqual(self.health['integrity'], 'ok')
        self.assertEqual(self.health['counts']['source_documents'], 125)
        self.assertEqual(self.health['counts']['source_pages'], 5887)
        with connect(self.path) as connection:
            self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
            for year in range(2022, 2027):
                count = connection.execute("SELECT count(*) FROM requirement_evidence e JOIN source_documents d ON d.id=e.source_id WHERE d.entrance_year=? AND e.requirement_kind='tap'", (year,)).fetchone()[0]
                self.assertGreater(count, 0)
            source = connection.execute("SELECT id FROM source_documents WHERE entrance_year=2023 AND label='原子力安全工学科'").fetchone()[0]
            document = read_document(connection, source)
            self.assertGreater(len(document['courses']), 0)
            self.assertEqual(len(document['pages']), document['pageCount'])

    def test_reimport_preserves_student_and_backup(self):
        profile_id = str(uuid4())
        with connect(self.path) as connection:
            saved = save_profile(connection, profile_id, self.profile())
        import_reference_data(self.path)
        with connect(self.path) as connection:
            self.assertEqual(read_profile(connection, profile_id), saved)
        backup = Path(self.directory.name) / 'backup.sqlite3'
        backup_database(backup, self.path)
        self.assertEqual(database_health(backup)['integrity'], 'ok')
        with self.assertRaises(ValueError):
            backup_database(backup, self.path)

    def test_http_catalog_document_programs_and_profile(self):
        with patch.dict(os.environ, CURRICULUM_DB_PATH=str(self.path)):
            server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_port}'
            try:
                def get(path):
                    with urlopen(base + path) as response:
                        return json.load(response)
                catalog = get('/api/handbooks/catalog')
                self.assertEqual(len(catalog['documents']), 125)
                source = catalog['documents'][0]
                self.assertEqual(get('/api/handbooks/documents/' + source['id'])['sha256'], source['sha256'])
                self.assertEqual(len(get('/api/hirameki/programs')['programs']), 6)
                self.assertTrue(get('/api/tap/faq')['entries'])
                with connect(self.path) as connection:
                    cohorts = connection.execute('SELECT department_id,entrance_year FROM cohort_datasets').fetchall()
                self.assertEqual(len(cohorts), 95)
                for department_id, year in cohorts:
                    dataset = get(f'/api/curricula/{department_id}/{year}')
                    self.assertEqual((dataset['departmentId'], dataset['entranceYear']), (department_id, year))
                    if department_id == 'design_data' and year == 2022:
                        self.assertEqual(dataset['status'], 'unavailable')
                        self.assertEqual(dataset['courses'], [])
                    else:
                        self.assertGreater(len(dataset['courses']), 0)
                        self.assertTrue(all(course['curriculumYear'] == year and course['departmentId'] == department_id for course in dataset['courses']))
                        # Unverified CSV rules must not reappear as authoritative requirements.
                        self.assertTrue(dataset['referenceOnly'])
                        self.assertEqual(dataset['curriculum']['requiredCredits'], 0)
                profile_id = str(uuid4())
                self.assertIsNone(get('/api/students/' + profile_id))
                request = Request(base + '/api/students/' + profile_id, data=json.dumps(self.profile()).encode(), headers={'Content-Type': 'application/json'}, method='PUT')
                with urlopen(request) as response:
                    self.assertEqual(json.load(response)['revision'], 1)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def test_invalid_source_rolls_back_entire_import(self):
        before = database_health(self.path)
        def corrupted(path):
            value = read_json(path)
            if path.parent.name == 'extracted':
                value['sha256'] = '0' * 64
            return value
        with patch('backend.database.read_json', side_effect=corrupted), self.assertRaises(ValueError):
            import_reference_data(self.path)
        self.assertEqual(database_health(self.path), before)


if __name__ == '__main__':
    unittest.main()
