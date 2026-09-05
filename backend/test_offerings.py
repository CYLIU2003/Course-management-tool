"""Read-only reconciliation against downloaded official evidence and SQLite."""
import hashlib
import json
import unittest
from collections import Counter

from .database import ROOT, connect
from scripts.curriculum.import_offerings import apply_change


class OfferingEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.extracted = json.loads((ROOT / 'data/import/offerings-2026.json').read_text(encoding='utf-8'))
        with connect() as db:
            cls.classes = [json.loads(row[0]) for row in db.execute('SELECT payload_json FROM scheduled_offerings WHERE academic_year=2026')]
            cls.sources = [json.loads(row[0]) for row in db.execute('SELECT metadata_json FROM offering_sources WHERE academic_year=2026')]
            cls.audit = json.loads(db.execute('SELECT payload_json FROM offering_imports WHERE academic_year=2026').fetchone()[0])

    def test_all_downloads_match_recorded_hashes(self):
        self.assertEqual(len(self.sources), 35)
        for source in self.sources:
            raw = (ROOT / 'public' / source['localPath'].lstrip('/')).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), source['sha256'], source['id'])

    def test_every_canonical_code_occurrence_is_preserved_once(self):
        rows = [r for r in self.extracted['rows'] if r['canonical']]
        counts = Counter(r['lectureCode'] for r in rows)
        self.assertEqual(len(rows), 8576)
        self.assertEqual(len({c['id'] for c in self.classes}), len(self.classes))
        for course in self.classes:
            self.assertEqual(len(course['sourceOccurrences']), counts[course['lectureCode']])
        for doc in self.extracted['documents']:
            if doc['canonical']:
                self.assertEqual(doc['codeOccurrences'], doc['extractedRows'], doc['sourceId'])
        self.assertTrue(all(r['title'] and r['departmentLabel'] for r in rows))

    def test_shared_cell_and_open_bottom_row_survive(self):
        rows = [r for r in self.extracted['rows'] if r['canonical']]
        teaching = [r for r in rows if r['lectureCode'] == 'saz007634']
        self.assertTrue(teaching)
        self.assertTrue(all('教育実習' in r['title'].replace('\n', '') for r in teaching))
        self.assertTrue(any(r['sourceId'] == 'offering-2026-909a025b884cee994493' and r['page'] == 12 for r in rows))

    def test_corrections_do_not_cross_terms_or_erase_conditions(self):
        row = dict(campus='setagaya', term='前期前', room='71B')
        change = dict(campus='setagaya', term='後期後', field='教室変更', before='71B', after='71A', change='71B→71A')
        self.assertEqual(apply_change(row, change), 'different_term')
        self.assertEqual(row['room'], '71B')
        change.update(term='前期前', after='71A ※初回のみ', change='71B→71A ※初回のみ')
        self.assertEqual(apply_change(row, change), 'source_review_required')
        self.assertEqual(row['room'], '71B')

    def test_older_graduate_document_has_no_unrepresented_codes(self):
        old_codes = {r['lectureCode'] for r in self.extracted['rows'] if r['sourceId'] == 'offering-2026-5fd548ea92a503ccc47e'}
        self.assertTrue(old_codes)
        self.assertFalse(old_codes - {c['lectureCode'] for c in self.classes})


if __name__ == '__main__':
    unittest.main()
