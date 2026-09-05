"""Extract timetable rows by lecture-code position, retaining every source occurrence."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'public/offerings/2026'
CODE = re.compile(r'^[a-z]{2,5}\d{6,10}$')
FIELDS = ['departmentLabel', 'day', 'period', 'term', 'gradeYear', 'className', 'title', 'teacher', 'lectureCode', 'room', 'target', 'remarks']
CANONICAL = {'bdd00cb5d971b29dcea530b6758858ef.pdf', 'ede8727c2715d47e891b76cc03504ac3.pdf', '9c74fabca74255b40c7b0937b4083631.pdf', '45f62652853be3c046219378c75c02e4.pdf', '20ef6bb7920bc38870a5898b50e40f74-1.pdf', '8f0e6e5654ede6e1d81aee0e7c74d4ea.pdf'}


def normalize(text):
    return unicodedata.normalize('NFKC', text).strip()


def in_box(word, box):
    x, y = (word[0] + word[2]) / 2, (word[1] + word[3]) / 2
    return box[0] - .1 <= x <= box[2] + .1 and box[1] - .1 <= y <= box[3] + .1


def text_in(words, box):
    selected = sorted([w for w in words if in_box(w, box)], key=lambda w: (round(w[1], 1), w[0]))
    lines = []
    last_y = None
    for word in selected:
        if last_y is None or abs(word[1] - last_y) > 2:
            lines.append(word[4])
            last_y = word[1]
        else:
            lines[-1] += word[4]
    return normalize('\n'.join(lines))


def extract_table(page, table, words, characters):
    header = table.extract()[0]
    if len(header) < 12 or header[8] != '講義コード' or header[6] != '科目名':
        return []
    columns = table.rows[0].cells[:12]
    if any(cell is None for cell in columns):
        return []
    column_characters = [[c for c in characters if box[0] <= (c[0]+c[2])/2 <= box[2]] for box in columns]
    code_box = columns[8]
    anchors = sorted([w for w in words if CODE.fullmatch(w[4]) and code_box[0] <= w[0] <= code_box[2] and table.bbox[1] < w[1] < table.bbox[3]], key=lambda w: w[1])
    cells = [cell for cell in table.cells if cell]
    rows = []
    for index, anchor in enumerate(anchors):
        cy = (anchor[1] + anchor[3]) / 2
        values = {}
        boxes = {}
        for col, field in enumerate(FIELDS):
            cx = (columns[col][0] + columns[col][2]) / 2
            matches = [c for c in cells if c[0] <= cx <= c[2] and c[1] <= cy <= c[3]]
            if not matches:
                values[field] = ''
                continue
            box = list(min(matches, key=lambda c: (c[2]-c[0])*(c[3]-c[1])))
            box[0], box[2] = columns[col][0], columns[col][2]
            unsplit_box = list(box)
            # Missing drawn separators can join several courses into one table cell.
            # Split such cells using the next lecture-code baseline, never forward-fill titles.
            if col >= 6:
                contained = [a for a in anchors if box[1] <= (a[1]+a[3])/2 <= box[3]]
                if len(contained) > 1:
                    box[1] = max(box[1], anchor[1] - .3)
                    if index + 1 < len(anchors):
                        box[3] = min(box[3], anchors[index+1][1] - .3)
            boxes[field] = [round(n, 3) for n in box]
            values[field] = text_in(column_characters[col], box)
            if not values[field] and col >= 6 and col != 8:
                values[field] = text_in(column_characters[col], unsplit_box)
        values['lectureCode'] = anchor[4]
        values['bbox'] = list(anchor[:4])
        values['fieldBoxes'] = boxes
        rows.append(values)
    return rows


def parse_page(page):
    words = page.get_text('words')
    characters = [(*c['bbox'], c['c']) for block in page.get_text('rawdict')['blocks'] if block['type'] == 0 for line in block['lines'] for span in line['spans'] for c in span['chars']]
    raw_codes = [dict(code=w[4], bbox=list(w[:4])) for w in words if CODE.fullmatch(w[4])]
    finder = page.find_tables()
    tables = finder.tables
    candidates = [t for t in tables if t.col_count >= 12 and t.extract()[0][8] == '講義コード']
    if candidates:
        header = candidates[0].rows[0].cells
        # Final pages end with open vertical rules. Close at the actual
        # lowest rule endpoint, not at an invented next-course boundary.
        left, right = header[0][0], header[11][2]
        vertical_ends = [drawing['rect'].y1 for drawing in page.get_drawings() if left-.5 <= drawing['rect'].x0 <= right+.5]
        if vertical_ends:
            bottom = max(vertical_ends)
            finder = page.find_tables(add_lines=[((left, bottom), (right, bottom))])
            tables = finder.tables
    rows = [row for table in tables for row in extract_table(page, table, words, characters)]
    return dict(page=page.number+1, text=page.get_text(), codeOccurrences=raw_codes, rows=rows,
                                  tables=[dict(bbox=list(t.bbox), rows=t.extract()) for t in tables])


def extract():
    catalog = json.loads((BASE / 'catalog.json').read_text(encoding='utf-8'))
    result, audit = [], []
    output = BASE / 'extracted'
    output.mkdir(exist_ok=True)
    for source in catalog['documents']:
        path = ROOT / 'public' / source['localPath'].lstrip('/')
        if path.suffix.lower() != '.pdf':
            continue
        cached = output / (source['id'] + '.json')
        if cached.exists() and json.loads(cached.read_text(encoding='utf-8')).get('parserVersion') in (2, 3):
            document = json.loads(cached.read_text(encoding='utf-8'))
            if document.get('sha256') != source['sha256']:
                raise ValueError('Stale extraction; remove only the changed source cache and re-extract')
            if document['parserVersion'] == 2:
                with pymupdf.open(path) as pdf:
                    for index, page in enumerate(document['pages']):
                        if document['canonical'] and (len(page['rows']) != len(page['codeOccurrences']) or any(not row['departmentLabel'] or not row['title'] for row in page['rows'])):
                            document['pages'][index] = parse_page(pdf[index])
                document['parserVersion'] = 3
                cached.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding='utf-8')
        else:
            document = dict(parserVersion=3, sourceId=source['id'], sha256=source['sha256'], canonical=path.name in CANONICAL, pages=[])
            with pymupdf.open(path) as pdf:
                for page in pdf:
                    document['pages'].append(parse_page(page))
            cached.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding='utf-8')
        count = sum(len(p['rows']) for p in document['pages'])
        raw_count = sum(len(p['codeOccurrences']) for p in document['pages'])
        audit.append(dict(sourceId=source['id'], filename=path.name, label=source['references'][0]['label'], canonical=document['canonical'], pages=len(document['pages']), codeOccurrences=raw_count, extractedRows=count))
        for page in document['pages']:
            for row in page['rows']:
                result.append(dict(row, sourceId=source['id'], sourceSha256=source['sha256'], page=page['page'], canonical=document['canonical'], campus=source['references'][0]['campus']))
        print(f"{path.name}: {count}/{raw_count} code occurrences; canonical={document['canonical']}", flush=True)
    destination = ROOT / 'data/import/offerings-2026.json'
    destination.write_text(json.dumps(dict(year=2026, documents=audit, rows=result), ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    extract()
