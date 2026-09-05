"""Check cached rows against original PDF glyph positions and curriculum headings.

This is a conservative machine check, not a certification of graduation rules.
Unresolved rows stay in the source archive but cannot enter course search.
"""
import hashlib
import json
from pathlib import Path
import re

import pymupdf

from course_titles import compact
from pdf_unicode import recover_unicode

ROOT = Path(__file__).resolve().parents[2]
EXTRACTED = ROOT / 'public/handbooks/extracted'
DEPARTMENTS = ['環境創生学科', '環境経営システム学科', '社会メディア学科', '情報システム学科',
               'デザイン・データ科学科', '都市生活学科', '人間科学科', '児童学科']
EXCLUDED = ('到達目標', '教職', '教諭', '免許', '測量士', '資格取得', '［指定科目］', '学則第20条')


def page_scope(document, page, previous):
    heading = compact(page['text'])[:450]
    if document['kind'] != 'handbook' or document['label'] == '教職課程':
        return None
    if any(term in heading[:120] for term in EXCLUDED):
        return None
    if '教育課程表' in heading[:220]:
        if document['label'].endswith('学科') or document['label'] == '共通分野':
            return document['label']
        if '学部共通科目' in heading[:120]:
            return document['faculty']
        matches = [name for name in DEPARTMENTS if name in heading[:220]]
        return matches[0] if len(matches) == 1 else None
    # Continuation is allowed only on the next page with an actual timetable header.
    headers = ''.join(compact(str(row)) for table in page['tables'] for row in table['rows'][:4])
    if previous and '授業科目' in headers and '単' in headers and '位' in headers:
        return previous
    return None


def all_chars(page):
    return [char for block in page.get_text('rawdict')['blocks'] for line in block.get('lines', [])
            for span in line['spans'] for char in span['chars'] if char['c'].strip()]


def center(char):
    box = char['bbox']
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def credit_anchors(chars):
    anchors = []
    for char in chars:
        if char['c'] != '位':
            continue
        x, y = center(char)
        if any(c['c'] == '単' and abs(center(c)[0] - x) < 3
               and 0 < y - center(c)[1] < 22 for c in chars):
            anchors.append((x, y, list(char['bbox'])))
    return anchors


def verify_row(course, words, chars, anchors, scope, sha256):
    if not scope:
        return {'status': 'quarantined', 'reason': 'outside_scoped_curriculum_table'}
    printed_title = course['title'].split('※')[0].strip()
    # G and teaching format are separate annotations in these original tables.
    if scope in {'人間科学科', '児童学科', '都市生活学科'}:
        printed_title = re.sub(r'\s*(?:G\s+)?(?:講義|演習|実験|実習)$', '', printed_title)
        printed_title = re.sub(r'\s+G$', '', printed_title)
    title = compact(printed_title)
    # Whole PDF words are independent of the table parser's clipped cell borders.
    matches = [word for word in words if compact(word[4]) == title]
    if not matches:
        ordered = sorted(words, key=lambda w: (round(w[1], 0), w[0]))
        for i, first in enumerate(ordered):
            combined = compact(first[4])
            last = first
            for following in ordered[i + 1:i + 8]:
                if abs(first[1] - following[1]) > 2 or not -1 <= following[0] - last[2] < 8:
                    break
                combined += compact(following[4])
                last = following
                if combined == title:
                    matches.append((first[0], first[1], last[2], max(first[3], last[3]), printed_title))
                    break
    if len(matches) != 1:
        return {'status': 'quarantined', 'reason': 'title_not_unique_in_pdf_words'}
    word = matches[0]
    y = (word[1] + word[3]) / 2
    candidates = []
    for x, header_y, header_box in anchors:
        if x <= word[2] or header_y >= y:
            continue
        digits = sorted([c for c in chars if abs(center(c)[0] - x) < 5
                         and abs(center(c)[1] - y) < 2.5], key=lambda c: c['bbox'][0])
        printed = ''.join(c['c'] for c in digits)
        if re.fullmatch(r'\d+(?:\.\d+)?', printed) and float(printed) == course['credits']:
            candidates.append({'headerBbox': header_box, 'text': printed,
                               'glyphBboxes': [list(c['bbox']) for c in digits]})
    if len(candidates) != 1:
        return {'status': 'quarantined', 'reason': 'credit_column_not_uniquely_confirmed'}
    return {'status': 'pdf_position_checked', 'scope': scope, 'sourceSha256': sha256,
            'titleText': printed_title, 'titleBbox': list(word[:4]), 'creditEvidence': candidates[0],
            'requiredTypeStatus': 'unreviewed', 'graduationInclusionStatus': 'unreviewed'}


def recover_numbered_rows(data, page_number, page, words, chars, anchors, scope, existing):
    """Recover rows missed by merged table headers, using printed course numbering.

    Only a unique numbered row with one credit column and a contiguous title is
    accepted. The ordinary verifier independently checks the resulting fields.
    """
    if not scope:
        return []
    recovered = []
    for code_word in words:
        code = compact(code_word[4])
        if not re.fullmatch(r'[A-Z]{2,3}-[0-9A-Z]{3}', code):
            continue
        if sum(compact(w[4]) == code for w in words) != 1:
            continue
        if any(c['sourceCode'] == code and c.get('verification', {}).get('status') == 'pdf_position_checked' for c in existing):
            continue
        y = (code_word[1] + code_word[3]) / 2
        columns = [(x, hy) for x, hy, _ in anchors if hy < y and x < code_word[0]]
        if len(columns) != 1:
            continue
        x, _ = columns[0]
        credit_chars = sorted([c for c in chars if abs(center(c)[0] - x) < 5
                               and abs(center(c)[1] - y) < 2.5], key=lambda c: c['bbox'][0])
        credit = ''.join(c['c'] for c in credit_chars)
        if not re.fullmatch(r'\d+(?:\.\d+)?', credit) or not 0 < float(credit) <= 20:
            continue
        left = sorted([w for w in words if page.rect.width * .14 < w[0] and w[2] < x - 12
                       and abs((w[1] + w[3]) / 2 - y) < 2.5 and w[3] - w[1] < 18
                       and re.search(r'[一-龯ぁ-んァ-ヶA-Za-z]', w[4]) and len(compact(w[4])) >= 2
                       and not w[4].startswith('※')], key=lambda w: w[0])
        if not left:
            continue
        title_words = [left[0]]
        for word in left[1:]:
            if not -1 <= word[0] - title_words[-1][2] < 8:
                break
            title_words.append(word)
        title = ' '.join(w[4] for w in title_words)
        course = dict(id=f"{data['id']}-p{page_number}-number-{code}", title=title,
                      credits=float(credit), rawRequired='', courseType='unknown', category='', group='',
                      sourceCode=code, sourceId=data['id'], page=page_number, table=-1, row=-1,
                      status='extracted_reference', rawCells=[], extractionMethod='numbered_pdf_row')
        evidence = verify_row(course, words, chars, anchors, scope, data['sha256'])
        if evidence['status'] == 'pdf_position_checked':
            evidence['sourceCodeBbox'] = list(code_word[:4])
            course['verification'] = evidence
            recovered.append(course)
    return recovered


def main():
    report = {'method': 'pdf-word-title-and-vertical-credit-header-v1', 'documents': [], 'reasons': {}}
    total = accepted = 0
    catalog_path = ROOT / 'public/handbooks/catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    for path in sorted(EXTRACTED.glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        data['courses'] = [c for c in data['courses'] if c.get('extractionMethod') != 'numbered_pdf_row']
        pdf_path = ROOT / 'public' / data['localPath'].lstrip('/')
        if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != data['sha256']:
            raise ValueError(f'Original PDF changed: {pdf_path}')
        by_page = {}
        for course in data['courses']:
            by_page.setdefault(course['page'], []).append(course)
        checked = 0
        previous = None
        with pymupdf.open(pdf_path) as pdf:
            recover_unicode(pdf)
            for cached_page in data['pages']:
                scope = page_scope(data, cached_page, previous)
                previous = scope
                courses = by_page.get(cached_page['page'], [])
                if not courses and not scope:
                    continue
                page = pdf[cached_page['page'] - 1]
                if page.rotation:
                    page.remove_rotation()
                words, chars = page.get_text('words'), all_chars(page)
                anchors = credit_anchors(chars)
                for course in courses:
                    evidence = verify_row(course, words, chars, anchors, scope, data['sha256'])
                    course['verification'] = evidence
                    if evidence['status'] == 'pdf_position_checked':
                        checked += 1
                    else:
                        reason = evidence['reason']
                        report['reasons'][reason] = report['reasons'].get(reason, 0) + 1
                recovered = recover_numbered_rows(data, cached_page['page'], page, words, chars, anchors, scope, courses)
                data['courses'].extend(recovered)
                checked += len(recovered)
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        report['documents'].append({'id': data['id'], 'label': data['label'], 'year': data['year'],
                                    'rawRows': len(data['courses']), 'positionChecked': checked})
        total += len(data['courses'])
        accepted += checked
        next(source for source in catalog['documents'] if source['id'] == data['id'])['courseCount'] = len(data['courses'])
        print(f"{data['year']} {data['label']}: {checked}/{len(data['courses'])}", flush=True)
    report.update(rawRows=total, positionChecked=accepted, quarantined=total - accepted)
    report['recoveredNumberedRows'] = sum(c.get('extractionMethod') == 'numbered_pdf_row'
                                        for path in EXTRACTED.glob('*.json')
                                        for c in json.loads(path.read_text(encoding='utf-8'))['courses'])
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'docs/pdf-course-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
