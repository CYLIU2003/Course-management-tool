"""Audit requirement-column geometry independently of category extraction."""
import json
import hashlib
import argparse
from pathlib import Path
import pymupdf
from classify_pdf_courses import ROOT, recover_unicode, structural_tables, cell_text
from requirement_cells import read_requirement_columns, requirement_headers, read_shared_2022_requirement, read_program_marks, SPREADS
from course_titles import compact


def apply_explicit_program_table(data, pdf):
    """Join the reviewed 2026 human-sciences program table by title AND credits."""
    if data['id'] != 'handbook-2026-9ac54018ba04a3dadd1774fcaec7facc':
        return
    if data['sha256'] != 'c0e658d1beee8e76708dc00e1fccafe1e07a4115ab0a35572851879a3f1672dd':
        raise ValueError('Reviewed program table source changed')
    page = pdf[69]
    tables = [table for table in page.find_tables().tables if table.extract()[0][3] == '※ＭＳ']
    if len(tables) != 1:
        raise ValueError('Program table has no unique MS/DS header')
    table = tables[0]
    rows = table.extract()
    for row in rows[1:]:
        for column, symbol in [(3, 'MS'), (5, 'DS')]:
            title = compact(row[column])
            credits = float(compact(row[column + 1]).removesuffix('単位'))
            courses = [course for course in data['courses'] if course.get('verification', {}).get('status') == 'pdf_position_checked'
                       and compact(course['verification']['titleText']) == title and course['credits'] == credits]
            if len(courses) != 1 or 'requirementEvidence' not in courses[0]:
                raise ValueError(f'Program course has no unique verified curriculum row: {title}')
            courses[0]['requirementEvidence']['programMarks'].append(dict(symbol=symbol, page=70, bbox=list(table.bbox), headerBbox=list(table.rows[0].cells[column]), method='reviewed-explicit-program-table-title-and-credit'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append', help='Re-extract only these source IDs; audit still covers all documents')
    arguments = parser.parse_args()
    reports = []
    for path in sorted((ROOT / 'public/handbooks/extracted').glob('*.json')):
        data = json.loads(path.read_text(encoding='utf8'))
        if data['kind'] != 'handbook':
            continue
        if arguments.source and data['id'] not in arguments.source:
            courses = [course for course in data['courses'] if course.get('verification', {}).get('status') == 'pdf_position_checked']
            reports.append(dict(id=data['id'], checked=sum(course.get('requirementEvidence', {}).get('status') == 'pdf_requirement_cells_checked' for course in courses), courses=len(courses)))
            continue
        by_page = {}
        for course in data['courses']:
            if course.get('verification', {}).get('status') == 'pdf_position_checked':
                by_page.setdefault(course['page'], []).append(course)
        found = 0
        pdf_path = ROOT / 'public' / data['localPath'].lstrip('/')
        if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != data['sha256']:
            raise ValueError(f"Requirement PDF changed: {data['id']}")
        with pymupdf.open(pdf_path) as pdf:
            recover_unicode(pdf)
            for number, courses in by_page.items():
                is_shared_spread = data['id'] in SPREADS and number == 10
                page = pdf[10 if is_shared_spread else number - 1]
                if page.rotation:
                    page.remove_rotation()
                tables = structural_tables(page)
                chars = [c for block in page.get_text('rawdict')['blocks'] for line in block.get('lines', [])
                         for span in line['spans'] for c in span['chars']]
                cells = {tuple(box) for table in tables for box in table.cells if box}
                headers = requirement_headers(cells, chars)
                first_y = min((course['verification']['titleBbox'][1]+course['verification']['titleBbox'][3])/2 for course in courses)
                spread_headers = {cell_text(chars, box): box for box in cells if box[3] < first_y} if is_shared_spread else None
                if not headers and not is_shared_spread:
                    # Some PDFs encode the original header border as filled
                    # shapes; retain it when the line-only pass loses it.
                    cells = {tuple(box) for table in page.find_tables().tables for box in table.cells if box}
                    headers = requirement_headers(cells, chars)
                program_headers = [box for box in cells if cell_text(chars, box) in {'※DS/※MS', '※DS※MS', 'DS/MS', 'DSMS'}]
                if is_shared_spread:
                    left_chars = [c for block in pdf[9].get_text('rawdict')['blocks'] for line in block.get('lines', [])
                                  for span in line['spans'] for c in span['chars']]
                for course in courses:
                    course.pop('requirementEvidence', None)
                    evidence = read_shared_2022_requirement(course, cells, chars, spread_headers) if is_shared_spread else read_requirement_columns(course, cells, chars, headers)
                    if evidence:
                        if not is_shared_spread:
                            evidence['programMarks'] = read_program_marks(course, chars, evidence['headerBbox'], program_headers)
                        else:
                            evidence['programMarks'] = read_program_marks(course, left_chars, course['verification']['creditEvidence']['headerBbox'], [])
                        for mark in evidence['programMarks']:
                            mark['page'] = course['page']
                        course['requirementEvidence'] = evidence
                        found += 1
            apply_explicit_program_table(data, pdf)
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
        reports.append(dict(id=data['id'], checked=found, courses=sum(map(len, by_page.values()))))
        print(data['id'], found, flush=True)
    (ROOT / 'docs/requirement-column-coverage.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf8')


if __name__ == '__main__':
    main()
