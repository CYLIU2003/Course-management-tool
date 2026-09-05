"""Extract searchable page evidence and curriculum rows without inventing rules.

Tables remain attached to their original page. Course rows are reference data:
neither ambiguous tables nor prose conditions are promoted to graduation rules.
"""
import hashlib
import json
from pathlib import Path
import re
import unicodedata

import pymupdf
from pdf_unicode import recover_unicode
from course_titles import recover_course_titles

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'public/handbooks'
TOPICS = {
    'graduation': ('卒業要件', '卒業条件', '卒業資格', '卒業に必要'),
    'progression': ('進級', '着手条件'),
    'registration': ('履修登録', '履修上', '履修条件', '先修', '履修制限'),
    'curriculum': ('教育課程表', '授業科目', '科目一覧', '単位数'),
    'hirameki': ('ひらめき', 'ことづくり', 'くらしづくり', '修了要件'),
}


def normalize(text):
    return unicodedata.normalize('NFKC', text or '')


def compact(text):
    return re.sub(r'\s+', '', normalize(text))


def find_column(headers, names):
    return next((i for i, value in enumerate(headers) if compact(value) in names), None)


def read_course_table(page, table, rows):
    """Recover credit cells merged with weekly-hours cells using the printed header.

    A vertically printed 単/位/数 header anchors the credit column; the adjacent
    weekly-hour numbers must never become course credits. Original rows are kept.
    """
    adjusted = [list(row) for row in rows]
    for header_index, row in enumerate(rows[:3]):
        if find_column(row, {'授業科目', '授業科目名', '科目名'}) is None:
            continue
        credit_col = next((i for i, cell in enumerate(row)
                           if compact(cell).startswith('単') and '位' in compact(cell)), None)
        if credit_col is None:
            continue
        header_box = table.rows[header_index].cells[credit_col]
        if not header_box:
            continue
        chars = [char for block in page.get_text('rawdict')['blocks'] for line in block.get('lines', [])
                 for span in line['spans'] for char in span['chars']]
        anchor_chars = [char for char in chars if char['c'] == '位'
                        and header_box[0] <= (char['bbox'][0] + char['bbox'][2]) / 2 <= header_box[2]
                        and header_box[1] <= (char['bbox'][1] + char['bbox'][3]) / 2 <= header_box[3]]
        if len(anchor_chars) != 1:
            continue
        anchor = anchor_chars[0]
        center = (anchor['bbox'][0] + anchor['bbox'][2]) / 2
        adjusted[header_index][credit_col] = '単位数'
        for row_index in range(header_index + 1, len(rows)):
            if re.fullmatch(r'\d+(?:\.\d+)?', compact(rows[row_index][credit_col])):
                continue
            box = table.rows[row_index].cells[credit_col]
            if not box:
                continue
            # Use character centers rather than their bounding boxes: PDF borders
            # sometimes cut a digit's bbox but not its actual column center.
            cell_chars = [char for char in chars if abs((char['bbox'][0] + char['bbox'][2]) / 2 - center) < 7
                          and box[1] < (char['bbox'][1] + char['bbox'][3]) / 2 < box[3]]
            cell_chars.sort(key=lambda char: (round(char['origin'][1], 1), char['origin'][0]))
            adjusted[row_index][credit_col] = ''.join(char['c'] for char in cell_chars)
        return adjusted
    return adjusted


def extract_courses(rows, source_id, page_number, table_index):
    """Only accept an explicit subject-name column AND an explicit credit column."""
    header_index = None
    for index, row in enumerate(rows[:5]):
        title_col = find_column(row, {'授業科目', '授業科目名', '科目名'})
        credits_col = find_column(row, {'単位数', '単位'})
        if title_col is not None and credits_col is not None:
            header_index = index
            break
    if header_index is None:
        return [], []
    headers = rows[header_index]
    flag_col = find_column(headers, {'必選の別', '必修選択', '必・選', '必選', '必修・選択'})
    code_col = find_column(headers, {'科目ナンバリング', 'ナンバリング', '科目番号'})
    category_col = find_column(headers, {'区分', '科目区分'})
    group_col = find_column(headers, {'科目群', '群'})
    courses, issues = [], []
    category = group = ''
    for row_index, row in enumerate(rows[header_index + 1:], header_index + 1):
        if category_col is not None and row[category_col]:
            category = compact(row[category_col])
        if group_col is not None and row[group_col]:
            group = compact(row[group_col])
        title = normalize(row[title_col]).replace('\n', '').strip()
        if not title or title in {'授業科目', '授業科目名', '科目名'}:
            continue
        credit_text = compact(row[credits_col])
        if not re.fullmatch(r'\d+(?:\.\d+)?', credit_text) or not 0 < float(credit_text) <= 20:
            issues.append(dict(page=page_number, table=table_index, row=row_index, title=title,
                               reason='単位欄を一意の正数として抽出できない', rawCells=row))
            continue
        raw_flag = compact(row[flag_col]) if flag_col is not None else ''
        course_type = 'unknown'
        if flag_col is not None:
            if raw_flag in {'○', '〇', '◎', '必', '必修'}:
                course_type = 'required'
            elif raw_flag.startswith(('△', '◇', '◆', '□', '■', '☆', '▼', '▲', '選必', '選択必修')):
                course_type = 'elective-required'
            elif raw_flag in {'', '選', '選択'}:
                course_type = 'elective'
        courses.append(dict(id=f'{source_id}-p{page_number}-t{table_index}-r{row_index}', title=title,
                            credits=float(credit_text), rawRequired=raw_flag, courseType=course_type,
                            category=category, group=group,
                            sourceCode=compact(row[code_col]) if code_col is not None else '',
                            sourceId=source_id, page=page_number, table=table_index, row=row_index,
                            status='extracted_reference', rawCells=row))
    return courses, issues


def extract_document(record):
    path = ROOT / 'public' / record['localPath'].lstrip('/')
    source_id = f"{record['kind']}-{record['year']}-{path.stem}"
    # Persist a cache keyed by both source bytes and parser bytes.
    parser_hash = hashlib.sha256(Path(__file__).read_bytes() + Path(__file__).with_name('pdf_unicode.py').read_bytes() + Path(__file__).with_name('course_titles.py').read_bytes()).hexdigest()
    output = DEST / 'extracted' / f'{source_id}.json'
    if output.exists():
        previous = json.loads(output.read_text(encoding='utf-8'))
        if previous['sha256'] == record['sha256'] and previous.get('parserHash') == parser_hash:
            return previous
    pages, courses, issues = [], [], []
    with pymupdf.open(path) as document:
        unicode_repairs = recover_unicode(document)
        for page_number, page in enumerate(document, 1):
            # Fold-out leaflets have /Rotate=90; normalize coordinates before reading rows.
            if page.rotation:
                page.remove_rotation()
            text = page.get_text(sort=True)
            search_text = compact(text)
            topics = [topic for topic, words in TOPICS.items() if any(word in search_text for word in words)]
            tables = []
            if topics or record['kind'] == 'hirameki':
                for table_index, table in enumerate(page.find_tables().tables):
                    rows = table.extract()
                    if len(rows) < 3:
                        continue
                    tables.append(dict(index=table_index, rows=rows, bbox=list(table.bbox)))
                    found, rejected = extract_courses(read_course_table(page, table, rows), source_id, page_number, table_index)
                    recover_course_titles(page, found)
                    courses.extend(found)
                    issues.extend(rejected)
            pages.append(dict(page=page_number, text=text, topics=topics, tables=tables,
                              hasText=bool(text.strip())))
    result = dict(**record, id=source_id, parserHash=parser_hash, pages=pages, courses=courses, issues=issues,
                  unicodeRepairs=unicode_repairs)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return result


def build_catalog():
    manifest = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    catalog, all_issues = [], []
    for record in manifest['documents']:
        data = extract_document(record)
        summary = {key: value for key, value in data.items() if key not in {'pages', 'courses', 'issues', 'parserHash'}}
        summary.update(dataPath=f"/handbooks/extracted/{data['id']}.json", courseCount=len(data['courses']),
                       tableCount=sum(len(page['tables']) for page in data['pages']),
                       topicPages={topic: [page['page'] for page in data['pages'] if topic in page['topics']] for topic in TOPICS},
                       pagesWithoutText=[page['page'] for page in data['pages'] if not page['hasText']],
                       reviewIssueCount=len(data['issues']))
        catalog.append(summary)
        all_issues.extend(dict(sourceId=data['id'], **issue) for issue in data['issues'])
        print(f"{record['year']} {record['label']}: {summary['courseCount']} courses / {summary['tableCount']} tables / {summary['reviewIssueCount']} review rows", flush=True)
    result = dict(schemaVersion=1, retrievedAt=manifest['retrievedAt'], documents=catalog)
    (DEST / 'catalog.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    (DEST / 'extraction-issues.json').write_text(json.dumps(all_issues, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    build_catalog()
