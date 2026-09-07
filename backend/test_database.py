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
from werkzeug.serving import make_server
from uuid import uuid4

from .database import ROOT, connect, initialize, import_reference_data, database_health, backup_database, read_json, validate_course_evidence
from .server import save_profile, read_profile, read_document
from .web import create_app


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

    def test_degree_minima_preserve_admission_year_and_course_variant(self):
        with connect(self.path) as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM degree_requirement_sets').fetchone()[0], 111)
            self.assertEqual(connection.execute('SELECT count(*) FROM degree_group_rules').fetchone()[0], 731)
            def minimum(department, year, variant, category):
                return connection.execute('SELECT minimum_credits FROM degree_category_rules WHERE requirement_set_id=? AND category_id=?',
                    (f'{department}:{year}:{variant}', category)).fetchone()[0]
            self.assertEqual(minimum('denki', 2022, 'standard', '理工学基礎科目'), 30)
            self.assertEqual(minimum('denki', 2023, 'standard', '理工学基礎科目'), 31)
            self.assertEqual(minimum('kenchiku', 2023, 'standard', '学部基盤科目'), 33)
            self.assertEqual(minimum('kenchiku', 2024, 'standard', '学部基盤科目'), 30)
            self.assertEqual(minimum('chino_joho', 2026, 'general', '外国語科目'), 8)
            self.assertEqual(minimum('chino_joho', 2026, 'international', '外国語科目'), 12)
            self.assertEqual(minimum('ningen', 2023, 'child', '教養・外国語・体育科目'), 20)
            self.assertEqual(minimum('ningen', 2024, 'human', '教養科目'), 6)
            required = connection.execute("SELECT minimum_credits FROM degree_group_rules WHERE requirement_set_id='denki:2022:standard' AND category='専門科目' AND membership='all_marked'").fetchone()[0]
            self.assertEqual(required, 32)

    def test_all_eight_combinations_round_trip(self):
        for teacher, hirameki, tap in itertools.product([False, True], repeat=3):
            profile_id = str(uuid4())
            value = self.profile()
            value.update(takesTeacher=teacher, takesHirameki=hirameki, takesTap=tap)
            with connect(self.path) as connection:
                saved = save_profile(connection, profile_id, value)
            with connect(self.path) as connection:
                self.assertEqual(saved, read_profile(connection, profile_id))

    def test_course_candidates_preserve_scoped_symbols_and_corrected_original_names(self):
        bundles = read_json(ROOT / 'data/import/curricula.json')['datasets']
        def courses(department, year):
            return next(bundle['courses'] for bundle in bundles if bundle['departmentId'] == department and bundle['entranceYear'] == year)
        for department, expected in [('denki', 'elective-required'), ('kikai', 'required')]:
            calculus = next(course for course in courses(department, 2022) if course['title'] == '微分積分学(2a)')
            self.assertEqual(calculus['courseType'], expected)
        names = {course['title'] for course in courses('denki', 2023)}
        self.assertIn('Next PBL(1)', names)
        self.assertIn('Next PBL(2)', names)
        self.assertNotIn('PBL(1)', names)
        self.assertNotIn('PBL(2)', names)
        with connect(self.path) as connection:
            rows = connection.execute("SELECT r.department_id,r.course_type,r.evidence_page FROM verified_course_requirements r JOIN course_records c ON c.id=r.course_id WHERE r.entrance_year=2022 AND json_extract(c.record_json,'$.requirementEvidence.courseCode')='10-211'").fetchall()
            self.assertEqual(len(rows), 8)
            actual = {row['department_id']: (row['course_type'], row['evidence_page']) for row in rows}
            self.assertEqual(actual['denki'], ('elective-required', 11))
            self.assertEqual(actual['kikai'], ('required', 11))
            self.assertEqual(connection.execute('SELECT count(DISTINCT course_id) FROM verified_course_categories').fetchone()[0], 19338)

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

    def test_degree_variant_is_bound_to_the_admission_cohort(self):
        profile_id = str(uuid4())
        value = dict(self.profile(), departmentId='ningen', entranceYear=2026, degreeVariant='child')
        with connect(self.path) as connection:
            saved = save_profile(connection, profile_id, value)
        with connect(self.path) as connection:
            self.assertEqual(read_profile(connection, profile_id), saved)
            self.assertEqual(read_profile(connection, profile_id)['degreeVariant'], 'child')
            self.assertIsNone(read_profile(connection, str(uuid4())))
        for variant in ['international', 42, False]:
            with self.assertRaises(ValueError), connect(self.path) as connection:
                save_profile(connection, str(uuid4()), dict(value, degreeVariant=variant))

    def test_schema_four_upgrade_preserves_existing_profile(self):
        profile_id = str(uuid4())
        with connect(self.path) as connection:
            saved = save_profile(connection, profile_id, self.profile())
        upgraded = Path(self.directory.name) / 'schema-four-upgrade.sqlite3'
        backup_database(upgraded, self.path)
        with connect(upgraded) as connection:
            connection.execute('ALTER TABLE student_profiles DROP COLUMN degree_variant')
            connection.execute('PRAGMA user_version=4')
        initialize(upgraded)
        with connect(upgraded) as connection:
            self.assertEqual(connection.execute('PRAGMA user_version').fetchone()[0], 5)
            self.assertEqual(read_profile(connection, profile_id), saved)

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
            server = make_server('127.0.0.1', 0, create_app())
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
                # Ownerless UUID endpoints were removed for public deployment.
                from urllib.error import HTTPError
                with self.assertRaises(HTTPError) as error:
                    get('/api/students/' + str(uuid4()))
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
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
