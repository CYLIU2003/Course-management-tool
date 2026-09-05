"""Produce a reviewable coverage report using SQL and original-file hashes."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.database import connect, database_health


def audit():
    catalog = json.loads((ROOT / 'public/handbooks/catalog.json').read_text(encoding='utf-8'))
    documents = catalog['documents']
    for document in documents:
        path = ROOT / 'public' / document['localPath'].lstrip('/')
        if hashlib.sha256(path.read_bytes()).hexdigest() != document['sha256']:
            raise ValueError(f'PDF hash mismatch: {path}')
    report = dict(database=database_health(), originalPdfHashesVerified=len(documents),
                  extractionReviewRows=sum(d['reviewIssueCount'] for d in documents),
                  pagesWithoutExtractableText=sum(len(d['pagesWithoutText']) for d in documents),
                  originalPdfBytes=sum((ROOT / 'public' / d['localPath'].lstrip('/')).stat().st_size for d in documents))
    with connect() as connection:
        report['tapPagesByCohort'] = [dict(row) for row in connection.execute("SELECT d.entrance_year AS year, count(*) AS pages FROM requirement_evidence e JOIN source_documents d ON d.id=e.source_id WHERE e.requirement_kind='tap' GROUP BY d.entrance_year")]
        report['teacherPagesByCohort'] = [dict(row) for row in connection.execute("SELECT d.entrance_year AS year, count(*) AS pages FROM requirement_evidence e JOIN source_documents d ON d.id=e.source_id WHERE e.requirement_kind='teacher' GROUP BY d.entrance_year")]
        report['cohorts'] = [dict(row) for row in connection.execute('SELECT department_id,entrance_year,status,course_count FROM cohort_datasets ORDER BY department_id,entrance_year')]
    output = ROOT / 'docs/curriculum-audit.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    audit()
