"""Recover each course's classification path from original merged PDF cells."""
import hashlib
import json
from pathlib import Path
import statistics
import argparse
import pymupdf
from pdf_unicode import recover_unicode
from course_titles import compact

ROOT = Path(__file__).resolve().parents[2]


def structural_tables(page):
    """Exclude outlined glyph strokes that otherwise split merged category cells."""
    paths = []
    for drawing in page.get_drawings():
        items = [item for item in drawing['items'] if (
            item[0] == 'l'
            and (abs(item[1].x - item[2].x) < .2 or abs(item[1].y - item[2].y) < .2)
            and abs(item[1] - item[2]) > 12
        ) or (
            item[0] == 're'
            and min(item[1].width, item[1].height) < 1.5
            and max(item[1].width, item[1].height) > 12
        )]
        if items:
            paths.append(dict(drawing, items=items))
    return page.find_tables(paths=paths).tables

# Labels read from the original curriculum tables. Unknown spellings are kept as
# unresolved evidence; they must not become invented categories in the guide.
LABELS = set('''基礎科目|外国語科目|英語科目(スキル)|英語科目(教養)|共通|英語以外の外国語科目|体育科目|教養科目|人文学系|社会科学系|人間科学系|自然・情報科学系|その他|PBL科目|専門基礎科目|専門科目|学科基盤科目|学科専門科目(ソーシャルデザイン分野)|学科専門科目(メディア・コミュニケーション分野)|学科専門科目(システムデザイン分野)|学科専門科目(ICTアセスメント分野)|専門教養|学部共通|ひらめきことづくり|学科共通|グリーンエレクトロニクス|次世代ドライブシステム|超スマートエネルギー社会|情報通信プラットフォーム|卒業研究関連科目|材料力学|熱流体工学|電気電子工学|制御工学|ロボット工学|宇宙工学|応用分野科目|プログラミング関連科目|実験実習科目|力学・材料|マネジメント|都市環境|都市防災|実験・実習系|有機・生物化学|物理化学・化学工学|無機・分析化学|理工学基礎科目|数学系|自然科学系|情報系|理工学教養系|自然|数理|学部基盤科目|総合系|建築基礎|建築計画・設計|建築工学|情報工学基盤科目|情報基盤系|知的経営システム|大規模データ解析|人工知能|人間情報システム|IoT|学科専門科目(生態環境分野)|学科専門科目(都市環境分野)|学科専門科目(環境経営分野)|学科専門科目(環境政策分野)|基幹科目|基礎共通科目|演習領域|都市のライフスタイル|都市のマネジメント|都市のデザイン|都市のしくみ|建築士対応科目|総合領域1|総合領域2|ことづくり|機械力学|流体力学|熱力学|材料学|加工学|原子炉工学|核燃料サイクル工学|原子力構造設計工学|原子力安全工学|放射線工学|計算機工学|メディア工学|情報数理|医学系|医用工学系|機械系|電気・電子・情報系|ひらめき|ものづくり|機械工学・力学|システム工学(学際領域)|グローバル教養系|英語科目|データ科学|専門応用科目|基礎総合領域|ユーザーエクスペリエンスデザイン|ソーシャルシステムデザイン'''.split('|'))


def inside(char, box):
    x = (char['bbox'][0] + char['bbox'][2]) / 2
    y = (char['bbox'][1] + char['bbox'][3]) / 2
    return box[0] < x < box[2] and box[1] < y < box[3]


def cell_text(chars, box, label=False):
    selected = [c for c in chars if inside(c, box) and c['c'].strip()
                and c['bbox'][0] >= box[0] - .4 and c['bbox'][2] <= box[2] + .4]
    if not selected:
        return ''
    # Tall Japanese merged cells read top-to-bottom, right column before left.
    height = max(c['bbox'][3] for c in selected) - min(c['bbox'][1] for c in selected)
    width = max(c['bbox'][2] for c in selected) - min(c['bbox'][0] for c in selected)
    size = statistics.median(c['bbox'][3] - c['bbox'][1] for c in selected)
    horizontal_pairs = any(abs(a['origin'][1] - b['origin'][1]) < 1
                           and 0 < b['origin'][0] - a['origin'][0] <= (a['bbox'][2] - a['bbox'][0]) * 1.15
                           for a, b in zip(selected, selected[1:]))
    vertical = not horizontal_pairs and height > max(width * 1.3, size * 2)
    key = (lambda c: (-round(c['origin'][0] / 3), c['origin'][1])) if vertical else (lambda c: (round(c['origin'][1] / 3), c['origin'][0]))
    value = compact(''.join(c['c'] for c in sorted(selected, key=key)))
    if label:
        alternatives = {value, compact(''.join(c['c'] for c in selected)),
                        compact(''.join(c['c'] for c in sorted(selected, key=lambda c: (-round(c['origin'][0] / 3), c['origin'][1])))),
                        compact(''.join(c['c'] for c in sorted(selected, key=lambda c: (round(c['origin'][1] / 3), c['origin'][0]))))}
        known = alternatives & LABELS
        return next(iter(known)) if len(known) == 1 else value
    return value


def classify(course, tables, chars, sha):
    evidence = course['verification']
    title = evidence['titleBbox']
    x, y = (title[0] + title[2]) / 2, (title[1] + title[3]) / 2
    matches = [(table, box) for table in tables for box in table.cells if box and box[0] <= x <= box[2] and box[1] <= y <= box[3]]
    if len(matches) != 1:
        return dict(status='unresolved', reason='title_cell_not_unique', sourceSha256=sha)
    table, title_box = matches[0]
    boxes = sorted({tuple(box) for box in table.cells if box and box[2] <= title_box[0] + 1 and box[1] < y < box[3]}, key=lambda box: box[0])
    path = []
    for box in boxes:
        text = cell_text(chars, box, label=True)
        if text:
            path.append(dict(label=text, bbox=list(box)))
    if not path:
        return dict(status='unresolved', reason='classification_cells_empty', sourceSha256=sha)
    if any(field['label'] not in LABELS for field in path):
        return dict(status='unresolved', reason='classification_text_requires_review', sourceSha256=sha, rawPath=path)
    credit_x = evidence['creditEvidence']['headerBbox'][0]
    flag_box = [title_box[2], y - 3, credit_x - 2, y + 3]
    flags = cell_text(chars, flag_box) if flag_box[0] < flag_box[2] else ''
    return dict(status='pdf_cell_checked', sourceSha256=sha, scope=evidence.get('scope'), path=path,
                printedRequirement=flags, requirementInterpretation='unreviewed', titleBbox=title, page=course['page'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--unresolved-only', action='store_true')
    parser.add_argument('--source', action='append', help='Classify selected sources; coverage still includes all sources')
    args = parser.parse_args()
    reviews = json.loads(Path(__file__).with_name('classification_regions.json').read_text(encoding='utf8'))['documents']
    reports = []
    for path in sorted((ROOT / 'public/handbooks/extracted').glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        if data['kind'] != 'handbook' or '研究科' in data['faculty']:
            continue
        pdf_path = ROOT / 'public' / data['localPath'].lstrip('/')
        assert hashlib.sha256(pdf_path.read_bytes()).hexdigest() == data['sha256']
        review = reviews.get(data['id'], {})
        if review and review['sourceSha256'] != data['sha256']:
            raise ValueError(f"Reviewed PDF changed: {data['id']}")
        accepted = [c for c in data['courses'] if c.get('verification', {}).get('status') == 'pdf_position_checked']
        if args.source and data['id'] not in args.source:
            resolved = sum(c.get('classification', {}).get('status') == 'pdf_cell_checked' for c in accepted)
            reports.append(dict(id=data['id'], year=data['year'], faculty=data['faculty'], label=data['label'], courses=len(accepted), classified=resolved, unresolved=len(accepted)-resolved))
            continue
        by_page = {}
        for course in accepted:
            if args.unresolved_only and not review and course.get('classification', {}).get('status') == 'pdf_cell_checked':
                continue
            by_page.setdefault(course['page'], []).append(course)
        with pymupdf.open(pdf_path) as pdf:
            recover_unicode(pdf)
            for number, courses in by_page.items():
                page = pdf[number - 1]
                if page.rotation:
                    page.remove_rotation()
                tables = structural_tables(page)
                chars = [c for block in page.get_text('rawdict')['blocks'] for line in block.get('lines', []) for span in line['spans'] for c in span['chars']]
                results = [classify(course, tables, chars, data['sha256']) for course in courses]
                # Some layouts use short legitimate cell rules. The original line
                # geometry remains a second source-backed reading, never a guess.
                fallback = page.find_tables().tables if any(r['status'] != 'pdf_cell_checked' for r in results) else []
                for course, result in zip(courses, results):
                    if result['status'] != 'pdf_cell_checked':
                        alternate = classify(course, fallback, chars, data['sha256'])
                        if alternate['status'] == 'pdf_cell_checked':
                            result = alternate
                    if result['status'] != 'pdf_cell_checked' and result.get('rawPath'):
                        fields = [dict(field, label=review.get('aliases', {}).get(field['label'], field['label'])) for field in result['rawPath']]
                        if all(f['label'] in LABELS | {'研究関連'} for f in fields):
                            result = dict(status='pdf_cell_checked', sourceSha256=data['sha256'], path=fields,
                                          method='pdf-render-reviewed-transcription', page=number)
                    title = course['verification']['titleBbox']
                    cx, cy = (title[0] + title[2]) / 2, (title[1] + title[3]) / 2
                    regions = [r for r in review.get('regions', []) if r['page'] == number
                               and r['courseArea'][0] < cx < r['courseArea'][2]
                               and r['courseArea'][1] < cy < r['courseArea'][3]]
                    if len(regions) > 1:
                        raise ValueError(f"Overlapping reviewed regions: {course['id']}")
                    if regions:
                        result = dict(status='pdf_cell_checked', sourceSha256=data['sha256'], path=regions[0]['path'],
                                      method='pdf-render-reviewed-region', page=number)
                    for parent in review.get('parents', []):
                        if parent['page'] == number and result.get('path') and result['path'][0]['label'] in parent['children']:
                            result['path'].insert(0, dict(label=parent['label'], bbox=parent['bbox'], page=parent['evidencePage']))
                            result['method'] = 'pdf-render-reviewed-parent'
                    result['scope'] = course['verification'].get('scope')
                    result['requirementInterpretation'] = 'unreviewed'
                    course['classification'] = result
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        resolved = sum(c['classification']['status'] == 'pdf_cell_checked' for c in accepted)
        reports.append(dict(id=data['id'],year=data['year'],faculty=data['faculty'],label=data['label'],courses=len(accepted),classified=resolved, unresolved=len(accepted)-resolved))
        print(f"{data['year']} {data['label']}: {resolved}/{len(accepted)}", flush=True)
    (ROOT/'docs/classification-coverage.json').write_text(json.dumps(dict(method='original-merged-cell-path-v2',
        requirementInterpretation='unreviewed', documents=reports),ensure_ascii=False,indent=2),encoding='utf-8')


if __name__ == '__main__':
    main()
