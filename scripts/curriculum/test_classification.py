import unittest
import json
from pathlib import Path
import pymupdf
from classify_pdf_courses import cell_text, classify, structural_tables, recover_unicode, ROOT
from requirement_cells import read_requirement_columns, requirement_headers, read_shared_2022_requirement
from apply_title_reviews import apply_title_reviews, REVIEWS
from verify_pdf_courses import verify_row, all_chars, credit_anchors


def glyph(letter, x, y):
    return {'c': letter, 'origin': (x, y), 'bbox': (x, y-4, x+4, y+1)}


class ClassificationTests(unittest.TestCase):
    def test_course_name_ending_in_practice_is_not_a_teaching_format(self):
        source_id = 'handbook-2023-83d7b838cc7113925d126dd31d7063d4'
        data = json.loads((ROOT / 'public/handbooks/extracted' / f'{source_id}.json').read_text(encoding='utf8'))
        course = next(c for c in data['courses'] if c['title'] == 'グラフィックデザイン演習')
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[64]
            chars = all_chars(page)
            evidence = verify_row(course, page.get_text('words'), chars, credit_anchors(chars), '都市生活学科', data['sha256'])
        self.assertEqual(evidence['status'], 'pdf_position_checked')
        self.assertEqual(evidence['titleText'], 'グラフィックデザイン演習')

    def test_merged_credit_and_hours_are_recovered_from_only_the_credit_column(self):
        source_id = 'handbook-2022-26f17f402ad9b49f74709de3e6cd1cc9'
        data = json.loads((ROOT / 'public/handbooks/extracted' / f'{source_id}.json').read_text(encoding='utf8'))
        course = dict(next(c for c in data['courses'] if '線形代数学(1a)' in c['title']), credits=11)
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[9]
            chars = all_chars(page)
            evidence = verify_row(course, page.get_text('words'), chars, credit_anchors(chars), '理工学部', data['sha256'], recover_credit=True)
        self.assertEqual(evidence['status'], 'pdf_position_checked')
        self.assertEqual(evidence['creditEvidence']['text'], '1')

    def test_half_credit_keeps_its_last_digit_outside_the_header_center(self):
        source_id = 'handbook-2022-ba18b28421362d72ddac50c16e252b29'
        data = json.loads((ROOT / 'public/handbooks/extracted' / f'{source_id}.json').read_text(encoding='utf8'))
        course = next(c for c in data['courses'] if c['title'] == 'Reading and Writing(1a)')
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[62]
            chars = all_chars(page)
            evidence = verify_row(course, page.get_text('words'), chars, credit_anchors(chars), '都市生活学科', data['sha256'])
        self.assertEqual(evidence['status'], 'pdf_position_checked')
        self.assertEqual(evidence['creditEvidence']['text'], '0.5')

    def test_vertical_two_columns(self):
        chars = [glyph(c, x, i*8+10) for x, text in [(20, '理工学'), (10, '基礎科目')] for i,c in enumerate(text)]
        self.assertEqual(cell_text(chars, (5, 0, 28, 60), label=True), '理工学基礎科目')

    def test_horizontal_wrapped_group(self):
        chars = [glyph(c, 10+i*4, 10+j*8) for j,line in enumerate(['卒業研','究関連','科目']) for i,c in enumerate(line)]
        self.assertEqual(cell_text(chars, (5, 0, 28, 40), label=True), '卒業研究関連科目')

    def test_neighbor_glyph_crossing_border_is_excluded(self):
        chars = [glyph(c, 10, 10+i*8) for i,c in enumerate('専門科目')]+[glyph('用', 23, 12)]
        self.assertEqual(cell_text(chars, (5, 0, 24, 50), label=True), '専門科目')

    def test_outlined_letters_do_not_cut_the_original_merged_category(self):
        source_id = 'handbook-2023-0188268e62a307b1b69c8517bfde4405'
        data = json.loads((ROOT / 'public/handbooks/extracted' / f'{source_id}.json').read_text(encoding='utf8'))
        course = next(c for c in data['courses'] if c['page'] == 84 and 'Communication' in c['title'] and c.get('verification', {}).get('status') == 'pdf_position_checked')
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[83]
            tables = structural_tables(page)
            chars = [c for b in page.get_text('rawdict')['blocks'] for line in b.get('lines', []) for span in line['spans'] for c in span['chars']]
            result = classify(course, tables, chars, data['sha256'])
        self.assertEqual([field['label'] for field in result['path']], ['基礎科目', '外国語科目', '英語科目(スキル)'])

    def test_visual_review_is_bound_to_an_unchanged_source(self):
        reviews = json.loads(Path(__file__).with_name('classification_regions.json').read_text(encoding='utf8'))
        for source_id, review in reviews['documents'].items():
            data = json.loads((ROOT / 'public/handbooks/extracted' / f'{source_id}.json').read_text(encoding='utf8'))
            self.assertEqual(data['sha256'], review['sourceSha256'], source_id)
            for region in review['regions']:
                self.assertGreaterEqual(region['page'], 1)
                self.assertLessEqual(region['page'], data['pageCount'])
                self.assertTrue(region['path'])

    def test_undergraduate_checked_rows_have_source_bound_classifications(self):
        count = 0
        for path in (ROOT / 'public/handbooks/extracted').glob('*.json'):
            data = json.loads(path.read_text(encoding='utf8'))
            if data['kind'] != 'handbook' or '研究科' in data['faculty']:
                continue
            for course in data['courses']:
                if course.get('verification', {}).get('status') != 'pdf_position_checked':
                    continue
                classification = course.get('classification', {})
                self.assertEqual(classification.get('status'), 'pdf_cell_checked', course['id'])
                self.assertEqual(classification.get('sourceSha256'), data['sha256'], course['id'])
                self.assertTrue(classification.get('path'), course['id'])
                count += 1
        self.assertEqual(count, 19338)

    def test_parallel_degree_columns_do_not_read_the_qualification_columns(self):
        data = json.loads((ROOT / 'public/handbooks/extracted/handbook-2024-daac75bfbe8d3e385727e7b5d230e342.json').read_text(encoding='utf8'))
        course = next(c for c in data['courses'] if c['page'] == 60 and c['title'] == '保育者論')
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[59]
            tables = structural_tables(page)
            chars = [c for b in page.get_text('rawdict')['blocks'] for line in b.get('lines', []) for span in line['spans'] for c in span['chars']]
            cells = {tuple(box) for table in tables for box in table.cells if box}
            headers = requirement_headers(cells, chars)
            result = read_requirement_columns(course, cells, chars, headers)
        self.assertEqual([value['courseType'] for value in result['options']], ['required', 'unmarked'])
        self.assertEqual(len(result['options']), 2)
        self.assertLess(result['options'][-1]['bbox'][2], 283)

    def test_shared_spread_reads_the_department_column_on_the_facing_page(self):
        data = json.loads((ROOT / 'public/handbooks/extracted/handbook-2022-26f17f402ad9b49f74709de3e6cd1cc9.json').read_text(encoding='utf8'))
        courses = [c for c in data['courses'] if c['page'] == 10 and c.get('verification', {}).get('status') == 'pdf_position_checked']
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[10]
            chars = [c for b in page.get_text('rawdict')['blocks'] for line in b.get('lines', []) for span in line['spans'] for c in span['chars']]
            cells = {tuple(box) for table in structural_tables(page) for box in table.cells if box}
            results = {result['courseCode']: result for course in courses for result in [read_shared_2022_requirement(course, cells, chars)]}
        self.assertTrue(all(option['courseType'] == 'required' for option in results['10-111']['options']))
        differentiated = {option['departmentId']: option['printedSymbol'] for option in results['10-211']['options']}
        self.assertEqual(differentiated['denki'], '△1')
        self.assertEqual(differentiated['kikai'], '○')
        self.assertEqual(results['10-211']['page'], 11)
        self.assertEqual(results['10-211']['titlePage'], 10)
        bad = dict(courses[0], verification=dict(courses[0]['verification'], sourceSha256='changed'))
        with self.assertRaises(ValueError):
            read_shared_2022_requirement(bad, cells, chars)

    def test_reviewed_title_duplicates_keep_the_original_course_and_reject_the_wrong_row(self):
        reviews = json.loads(REVIEWS.read_text(encoding='utf8'))['reviews']
        for review in reviews:
            data = json.loads((ROOT / 'public/handbooks/extracted' / (review['sourceId'] + '.json')).read_text(encoding='utf8'))
            apply_title_reviews(data)
            rows = {course['id']: course for course in data['courses']}
            self.assertEqual(rows[review['acceptedId']]['verification']['status'], 'pdf_position_checked')
            self.assertEqual(rows[review['rejectedId']]['verification']['status'], 'quarantined')
            self.assertEqual(rows[review['rejectedId']]['verification']['replacementId'], review['acceptedId'])
            data['sha256'] = 'changed'
            with self.assertRaises(ValueError):
                apply_title_reviews(data)

    def test_second_table_uses_its_own_requirement_header(self):
        data = json.loads((ROOT / 'public/handbooks/extracted/handbook-2025-202457f6e199e17ea68701e06174ad20.json').read_text(encoding='utf8'))
        course = next(c for c in data['courses'] if c['page'] == 6 and c.get('verification', {}).get('titleText') == 'ことづくり(1)')
        with pymupdf.open(ROOT / 'public' / data['localPath'].lstrip('/')) as pdf:
            recover_unicode(pdf)
            page = pdf[5]
            chars = [c for b in page.get_text('rawdict')['blocks'] for line in b.get('lines', []) for span in line['spans'] for c in span['chars']]
            cells = {tuple(box) for table in structural_tables(page) for box in table.cells if box}
            headers = requirement_headers(cells, chars)
            result = read_requirement_columns(course, cells, chars, headers)
        self.assertEqual(len(headers), 2)
        self.assertGreater(result['headerBbox'][1], 300)
        self.assertEqual(len(result['options']), 1)


if __name__ == '__main__':
    unittest.main()
