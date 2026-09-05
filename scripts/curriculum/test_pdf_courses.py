"""Regression checks using original PDF pages, not copied extraction fixtures."""
import json
import unittest

import pymupdf

from verify_pdf_courses import ROOT, EXTRACTED, all_chars, credit_anchors, verify_row
from pdf_unicode import recover_unicode


class PdfCourseTests(unittest.TestCase):
    def source(self, label, year=2024):
        return next(data for path in EXTRACTED.glob(f'handbook-{year}-*.json')
                    if (data := json.loads(path.read_text(encoding='utf-8')))['label'] == label)

    def checked(self, data, title, page):
        return next(c for c in data['courses'] if c['page'] == page
                    and c.get('verification', {}).get('titleText') == title
                    and c['verification']['status'] == 'pdf_position_checked')

    def test_clipped_prefix_and_credit_are_confirmed_on_original_pdf(self):
        data = self.source('機械工学科')
        course = self.checked(data, '微分積分学(1a)', 4)
        self.assertEqual(course['credits'], 1)
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[3]
            words, chars = page.get_text('words'), all_chars(page)
            args = (words, chars, credit_anchors(chars), '機械工学科', data['sha256'])
            self.assertEqual(verify_row(course, *args)['status'], 'pdf_position_checked')
            self.assertEqual(verify_row(dict(course, credits=4), *args)['status'], 'quarantined')
            self.assertEqual(verify_row(dict(course, title='分積分学(1a)'), *args)['status'], 'quarantined')

    def test_merged_header_does_not_drop_information_science_foundation_page(self):
        data = self.source('情報科学科')
        course = self.checked(data, '数学演習(1a)', 4)
        self.assertEqual(course['credits'], .5)
        self.assertEqual(course['extractionMethod'], 'numbered_pdf_row')
        self.assertGreaterEqual(sum(c['page'] == 4 and c.get('verification', {}).get('status') == 'pdf_position_checked'
                                    for c in data['courses']), 50)

    def test_teaching_format_and_global_note_are_not_part_of_title(self):
        data = self.source('人間科学部')
        self.assertEqual(self.checked(data, '哲学(1)', 56)['credits'], 2)
        old = self.source('人間科学部', 2022)
        self.assertEqual(self.checked(old, '哲学(1)', 54)['verification']['scope'], '児童学科')

    def test_relationship_and_qualification_tables_are_quarantined(self):
        data = self.source('環境学部')
        for page in [99, 115, 119]:
            rows = [c for c in data['courses'] if c['page'] == page]
            self.assertTrue(rows)
            self.assertTrue(all(c['verification']['status'] == 'quarantined' for c in rows))
        self.assertEqual(self.checked(data, '環境マネジメントシステム', 92)['verification']['scope'], '環境創生学科')


if __name__ == '__main__':
    unittest.main()
