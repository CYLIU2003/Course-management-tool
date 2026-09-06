"""Read every original handbook table and inventory classification coverage.

Read-only for source data: this report is not a graduation certification.
"""
import hashlib
import json
from pathlib import Path
import pymupdf
from pdf_unicode import recover_unicode
from course_titles import compact

ROOT = Path(__file__).resolve().parents[2]


def main():
    reports = []
    for path in sorted((ROOT / 'public/handbooks/extracted').glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        if data['kind'] != 'handbook':
            continue
        source = ROOT / 'public' / data['localPath'].lstrip('/')
        assert hashlib.sha256(source.read_bytes()).hexdigest() == data['sha256']
        checked = [c for c in data['courses'] if c.get('verification', {}).get('status') == 'pdf_position_checked']
        pages = sorted({c['page'] for c in checked})
        tables = []
        with pymupdf.open(source) as pdf:
            recover_unicode(pdf)
            for number in pages:
                page = pdf[number - 1]
                if page.rotation:
                    page.remove_rotation()
                for table in page.find_tables().tables:
                    rows = table.extract()
                    if not any('授業科目' in compact(''.join(c or '' for c in row)) for row in rows[:5]):
                        continue
                    tables.append(dict(page=number, bbox=list(table.bbox), headers=rows[:4]))
        reports.append(dict(id=data['id'], year=data['year'], faculty=data['faculty'], label=data['label'],
                            sha256=data['sha256'], checkedCourses=len(checked), missingCategory=sum(not c['category'] for c in checked),
                            missingGroup=sum(not c['group'] for c in checked), groups=sorted({(c['category'], c['group']) for c in checked}), tables=tables))
        print(f"{data['year']} {data['label']}: {len(checked)} courses, {len(tables)} original tables", flush=True)
    report = dict(method='original-pdf-table-header-inventory-v1', documents=reports)
    (ROOT / 'docs/classification-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
