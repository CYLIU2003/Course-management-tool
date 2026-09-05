"""Public schedule responses shared by local SQLite and Supabase exports."""
import json


def catalog(connection, year=2026):
    rows = connection.execute('SELECT payload_json FROM scheduled_offerings WHERE academic_year=? ORDER BY lecture_code', (year,))
    classes=[]
    for row in rows:
        value=json.loads(row[0])
        classes.append({key:value[key] for key in ('id','year','lectureCode','title','titleVariants','meetings','audiences','status','sourceOccurrences','corrections')})
    sources=[json.loads(row[0]) for row in connection.execute('SELECT metadata_json FROM offering_sources WHERE academic_year=?',(year,))]
    return dict(year=year,classes=classes,sources=sources)


def audit(connection, year=2026):
    row=connection.execute('SELECT payload_json FROM offering_imports WHERE academic_year=?',(year,)).fetchone()
    return json.loads(row[0]) if row else None
