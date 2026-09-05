"""Apply the new title-only extraction step to existing table extraction caches."""
import hashlib
import json
from pathlib import Path
import pymupdf
from course_titles import recover_course_titles
from pdf_unicode import recover_unicode

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).parent
parser_hash = hashlib.sha256(b''.join((SCRIPTS / name).read_bytes() for name in ['extract_handbooks.py', 'pdf_unicode.py', 'course_titles.py'])).hexdigest()
total = 0
report = []
for path in (ROOT / 'public/handbooks/extracted').glob('*.json'):
    data = json.loads(path.read_text(encoding='utf-8'))
    pdf = ROOT / 'public' / data['localPath'].lstrip('/')
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != data['sha256']:
        raise ValueError(f'PDF changed: {pdf}')
    changed = 0
    with pymupdf.open(pdf) as document:
        recover_unicode(document)
        pages = {course['page'] for course in data['courses'] if course['sourceCode']}
        for number in pages:
            page = document[number - 1]
            if page.rotation:
                page.remove_rotation()
            changed += recover_course_titles(page, [course for course in data['courses'] if course['page'] == number])
    data['parserHash'] = parser_hash
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    if changed:
        report.append(dict(sourceId=data['id'], correctedTitles=changed))
    total += changed
(ROOT / 'docs/title-repair-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Corrected {total} titles from original PDF row coordinates in {len(report)} documents')
