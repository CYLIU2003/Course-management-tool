"""Read graduate category cells without using course titles as classification hints."""
from classify_pdf_courses import cell_text, structural_tables
import json
from pathlib import Path

SCOPES = {'機械', '電気・化学', '共同原子力', '自然科学', '建築・都市', '建築都市デザイン',
          '情報', '環境情報学', '都市生活学', '情報データ科学'}
LABELS = SCOPES | {name + '専攻' for name in SCOPES} | {
    '総合教養科目', '総合基礎科目', '専門基礎科目', '専門科目', '授業科目', '必修科目',
    '講究', '研究', '環境マネジメント', 'コミュニケーション環境', '情報システム',
    '地域・都市環境', '都市生活', '専門基礎', '共通', '環境', '消費', '生産', '政策・経営',
}


def classify_graduate_courses(pdf, data):
    reviews = json.loads(Path(__file__).with_name('classification_regions.json').read_text(encoding='utf8'))['documents']
    review = reviews.get(data['id'], {})
    if review and review['sourceSha256'] != data['sha256']:
        raise ValueError('Graduate category review source changed')
    by_page = {}
    for course in data['courses']:
        if course.get('verification', {}).get('status') == 'pdf_position_checked':
            by_page.setdefault(course['page'], []).append(course)
    for number, courses in by_page.items():
        page = pdf[number - 1]
        tables = structural_tables(page)
        chars = [c for block in page.get_text('rawdict')['blocks'] for line in block.get('lines', [])
                 for span in line['spans'] for c in span['chars']]
        for course in courses:
            title = course['verification']['titleBbox']
            x, y = (title[0] + title[2]) / 2, (title[1] + title[3]) / 2
            matches = [(t, b) for t in tables for b in t.cells if b and b[0] < x < b[2] and b[1] < y < b[3]]
            fields = []
            if len(matches) == 1:
                table, title_cell = matches[0]
                boxes = sorted({tuple(b) for b in table.cells if b and b[2] <= title_cell[0] + 1 and b[1] < y < b[3]})
                fields = [dict(label=cell_text(chars, box, label=True), bbox=list(box)) for box in boxes]
                fields = [f for f in fields if f['label']]
            if any(f['label'] not in LABELS for f in fields):
                raise ValueError(f"Unrecognized graduate category: {course['id']} {fields}")
            # Keep printed scope cells as evidence, but do not present a major as a category.
            path = [f for f in fields if f['label'] not in SCOPES and f['label'].removesuffix('専攻') not in SCOPES]
            if not path and fields:
                # Some dedicated-major tables do not divide their teaching courses into subcategories.
                path = fields
            regions = [region for region in review.get('regions', []) if region['page'] == number
                and region['courseArea'][0] < x < region['courseArea'][2] and region['courseArea'][1] < y < region['courseArea'][3]]
            if len(regions) > 1:
                raise ValueError('Overlapping graduate category regions')
            if regions:
                path = regions[0]['path']
            if not path:
                headings = page.search_for('関連科目')
                if len(headings) == 1:
                    path = [dict(label='関連科目', bbox=list(headings[0]))]
                else:
                    raise ValueError(f"Missing original graduate category: {course['id']}")
            course['classification'] = dict(status='pdf_cell_checked', sourceSha256=data['sha256'],
                scope=course['verification'].get('scope'), page=number, path=path, scopeCells=fields,
                method='graduate-original-merged-cells', requirementInterpretation='unreviewed')
