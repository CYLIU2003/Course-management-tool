"""Export only official reference API payloads. Never export accounts or personal records."""
import argparse
import hashlib
import json
from pathlib import Path

from backend.database import ROOT, connect
from backend.server import read_document
from backend import offerings


def reference_payloads(connection):
    yield '/api/registration-options', [dict(row) for row in connection.execute('SELECT d.id,d.name,f.name AS faculty,c.entrance_year AS entranceYear,c.status FROM departments d JOIN faculties f ON f.id=d.faculty_id JOIN cohort_datasets c ON c.department_id=d.id ORDER BY f.id,d.id,c.entrance_year')]
    for row in connection.execute('SELECT * FROM cohort_datasets'):
        yield f"/api/curricula/{row['department_id']}/{row['entrance_year']}",json.loads(row['payload_json'])
    for row in connection.execute('SELECT * FROM academic_calendars'):
        yield f"/api/academic-calendar/{row['academic_year']}",json.loads(row['payload_json'])
    documents=connection.execute('SELECT id,metadata_json FROM source_documents ORDER BY entrance_year,id').fetchall()
    yield '/api/handbooks/catalog',dict(schemaVersion=1,retrievedAt=connection.execute("SELECT value FROM dataset_meta WHERE key='retrievedAt'").fetchone()[0],documents=[json.loads(row['metadata_json']) for row in documents])
    for row in documents:
        yield '/api/handbooks/documents/'+row['id'],read_document(connection,row['id'])
    yield '/api/hirameki/programs',dict(schemaVersion=1,programs=[json.loads(row[0]) for row in connection.execute('SELECT record_json FROM programs ORDER BY id')])
    yield '/api/tap/faq',json.loads(connection.execute("SELECT record_json FROM web_evidence WHERE id='tap-faq'").fetchone()[0])
    for row in connection.execute('SELECT academic_year FROM offering_imports'):
        yield f'/api/offerings/{row[0]}',offerings.catalog(connection,row[0])
        yield f'/api/offerings/{row[0]}/audit',offerings.audit(connection,row[0])


def export(destination):
    destination.mkdir(parents=True,exist_ok=True)
    manifest=[]
    with connect() as db:
        for index,(route,payload) in enumerate(reference_payloads(db)):
            path=destination/f'{index:04}.json'
            path.write_text(json.dumps(dict(path=route,payload=payload),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
            manifest.append(dict(file=path.name,path=route,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    (destination/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(payloads=len(manifest),bytes=sum(row['bytes'] for row in manifest))))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'data/supabase-reference')
    export(parser.parse_args().output)
