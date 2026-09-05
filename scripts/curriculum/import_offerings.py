"""Idempotent schedule import with source occurrences, unique classes and corrections."""
import copy
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import pymupdf

from backend.database import ROOT, connect, initialize
from scripts.curriculum.extract_offerings import normalize

BASE = ROOT / 'public/offerings/2026'
CODE = re.compile(r'[a-z]{2,5}\d{6,10}')
DEPARTMENTS = {'機械':['kikai'],'機シ':['kikai_system'],'電通':['denki'],'医用':['iyo'],'応化':['ouyou_kagaku'],
               '原子':['genshiryoku'],'自然':['shizen_shizen','shizen_suuri'],'建築':['kenchiku'],'都市':['toshi_kogaku'],
               '情科':['joho_kagaku'],'知能':['chino_joho'],'都生':['toshi_seikatsu'],'人間':['ningen'],
               '環創':['kankyo_sosei'],'環経':['kankyo_keiei'],'社メ':['shakai_media'],'情シ':['joho_system'],'デ科':['design_data']}


def compact(text):
    return re.sub(r'\s+', '', normalize(text))


def corrections(catalog):
    result = []
    for source in catalog['documents']:
        if not any('変更一覧' in ref['label'] or '時間割訂正' in ref['label'] for ref in source['references']):
            continue
        doc = json.loads((BASE / 'extracted' / (source['id']+'.json')).read_text(encoding='utf-8'))
        with pymupdf.open(ROOT / 'public' / source['localPath'].lstrip('/')) as pdf:
            for page in doc['pages']:
                for ti, table in enumerate(page['tables']):
                    previous = [''] * len(table['rows'][0])
                    header = table['rows'][0]
                    above = normalize(pdf[page['page']-1].get_text(clip=pymupdf.Rect(0,0,600,table['bbox'][1])))
                    dates = re.findall(r'(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*訂正', above)
                    for ri, raw in enumerate(table['rows'][1:], 1):
                        values = [previous[i] if value is None else normalize(value) for i,value in enumerate(raw)]
                        previous = values
                        if header[0] == '変更日':
                            date, department, term, slot, title, codes, teacher, field, change = values
                            before, after = change.split('→',1) if '→' in change else ('',change)
                            date_parts = date.split('/')
                            date = f'{int(date_parts[0]):04}-{int(date_parts[1]):02}-{int(date_parts[2]):02}' if len(date_parts)==3 else date
                        elif len(header)==9 and header[3]=='講義コード':
                            _, pages, _, codes, title, teacher, field, before, after = values
                            department, term, slot = '', '', ''
                            date = f'2026-{int(dates[-1][0]):02}-{int(dates[-1][1]):02}' if dates else ''
                            change = before+'→'+after
                            if header[6] != '変更箇所':
                                term, field = field, '開講追加'
                                change = '\n'.join(values)
                        else:
                            codes = '\n'.join(CODE.findall('\n'.join(values)))
                            date = f'2026-{int(dates[-1][0]):02}-{int(dates[-1][1]):02}' if dates else ''
                            department=term=slot=title=teacher=before=after=''
                            field='資料全体の訂正'; change='\n'.join(values)
                        found = list(dict.fromkeys(CODE.findall(codes)))
                        if not found and not any('削除' in v or '変更' in v for v in values):
                            continue
                        result.append(dict(id=f"{source['id']}:{page['page']}:{ti}:{ri}", sourceId=source['id'],page=page['page'],date=date,
                                           campus=source['references'][0]['campus'],lectureCodes=found,department=department,term=term,slot=slot,
                                           title=title,teacher=teacher,field=field,before=before,after=after,change=change,raw=raw))
    return sorted(result,key=lambda x:(x['date'],x['sourceId'],x['page'],*[int(v) for v in x['id'].split(':')[-2:]]))


def apply_change(row, change):
    """Apply only unambiguous values; retain conditional dates/slots as review evidence."""
    before, after = compact(change['before']), normalize(change['after'])
    field = change['field']
    if change['campus'] != row['campus']:
        return 'different_campus'
    term = compact(change['term'])
    row_term = compact(row['term'])
    if term and term != row_term:
        # A semester-wide correction can cover both quarters, but a quarter
        # correction must never silently rewrite a semester-wide source row.
        if term in ('前期', '後期') and row_term.startswith(term):
            pass
        elif row_term in ('前期', '後期', '通年') and (term.startswith(row_term) or row_term == '通年'):
            return 'source_review_required'
        else:
            return 'different_term'
    if field in ('科目名','講義名') and before and after:
        if compact(row['title']) == compact(after): return 'already_reflected'
        if compact(row['title']) == before:
            row['title']=after; return 'applied'
    if ('曜日' in field or '時限' in field) and re.fullmatch(r'[月火水木金土日][1-9]→[月火水木金土日][1-9]',compact(change['change'])):
        old,new=compact(change['change']).split('→')
        if row['day']+row['period']==new: return 'already_reflected'
        if row['day']+row['period']==old:
            row['day'],row['period']=new[0],new[1]; return 'applied'
    if field in ('時限',) and re.fullmatch(r'[1-9]時限',before) and re.fullmatch(r'[1-9]時限',compact(after)):
        if row['period']==after[0]: return 'already_reflected'
        if row['period']==before[0]: row['period']=after[0]; return 'applied'
    target = 'room' if field in ('教室','教室変更') else 'teacher' if field in ('担当者','担当教員変更') else 'target' if field in ('受講対象','受講対象修正') else None
    if target and before and after and not any(mark in change['change'] for mark in ('※','のみ','除く','\n火','\n金',':','：')):
        current=compact(row[target])
        if current==compact(after): return 'already_reflected'
        if current==before or (target=='target' and current=='対象['+before+']'):
            row[target]=after if target!='target' else '対象['+after+']'; return 'applied'
    return 'source_review_required'


def import_data():
    initialize()
    catalog=json.loads((BASE/'catalog.json').read_text(encoding='utf-8'))
    extracted=json.loads((ROOT/'data/import/offerings-2026.json').read_text(encoding='utf-8'))
    for document in extracted['documents']:
        if document['canonical'] and document['codeOccurrences'] != document['extractedRows']:
            raise ValueError('Canonical timetable has missing lecture-code occurrences')
    changes=corrections(catalog)
    by_code=defaultdict(list)
    for change in changes:
        for code in change['lectureCodes']: by_code[code].append(change)
    groups=defaultdict(list)
    for row in extracted['rows']:
        if row['canonical']:
            if not row['title'] or not row['departmentLabel']:
                raise ValueError('A source row has no title or department')
            groups[row['lectureCode']].append(row)
    classes=[]
    for code, rows in groups.items():
        meetings={}; audiences={}; applications=[]
        titles=[]
        for original in rows:
            row=copy.deepcopy(original)
            for change in by_code[code]:
                status=apply_change(row,change)
                applications.append(dict(changeId=change['id'],sourceId=row['sourceId'],page=row['page'],status=status))
            title=row['title'].replace('\n','')
            if title not in titles: titles.append(title)
            meeting_key=(row['campus'],row['term'],row['day'],row['period'])
            meeting=meetings.setdefault(meeting_key,dict(campus=row['campus'],term=row['term'],day=row['day'],period=row['period'],rooms=[],teachers=[],remarks=[]))
            for key,field in [('rooms','room'),('teachers','teacher'),('remarks','remarks')]:
                if row[field] and row[field] not in meeting[key]: meeting[key].append(row[field])
            audience=dict(departmentLabel=row['departmentLabel'],departmentIds=DEPARTMENTS.get(row['departmentLabel'],[]),campus=row['campus'],gradeYear=row['gradeYear'],className=row['className'],target=row['target'])
            audiences[json.dumps(audience,sort_keys=True)]=audience
        classes.append(dict(id='2026:'+code,year=2026,lectureCode=code,title=titles[0],titleVariants=titles,meetings=list(meetings.values()),audiences=list(audiences.values()),corrections=by_code[code],correctionApplications=applications,
                            sourceOccurrences=[dict(sourceId=r['sourceId'],page=r['page'],bbox=r['bbox']) for r in rows],status='correction_review_required' if any(a['status']=='source_review_required' for a in applications) else 'source_extracted'))
    missing_changes=[change for change in changes if any(code not in groups for code in change['lectureCodes']) or not change['lectureCodes']]
    # Correction-only codes remain represented explicitly instead of fabricating missing slots.
    for code in sorted(set(by_code)-set(groups)):
        evidence=by_code[code]
        classes.append(dict(id='2026:'+code,year=2026,lectureCode=code,title=next((c['title'].replace('\n','') for c in evidence if c['title']),code),titleVariants=[],meetings=[],audiences=[],corrections=evidence,correctionApplications=[],sourceOccurrences=[],status='correction_only'))
    audit=dict(year=2026,sourceDocuments=len(catalog['documents']),canonicalCodeOccurrences=sum(d['codeOccurrences'] for d in extracted['documents'] if d['canonical']),canonicalRows=sum(len(v) for v in groups.values()),uniqueClasses=len(classes),canonicalClasses=len(groups),correctionRecords=len(changes),correctionOnlyClasses=len(set(by_code)-set(groups)),globalOrCorrectionOnlyRecords=len(missing_changes),duplicateClassKeys=len(classes)-len({c['id'] for c in classes}),classesNeedingCorrectionReview=sum(c['status']!='source_extracted' for c in classes),documents=extracted['documents'])
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        for source in catalog['documents']:
            raw=(ROOT/'public'/source['localPath'].lstrip('/')).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=source['sha256']: raise ValueError('Source hash mismatch')
            path=BASE/'extracted'/(source['id']+'.json')
            payload=json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
            db.execute('INSERT INTO offering_sources VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET metadata_json=excluded.metadata_json,payload_json=excluded.payload_json', (source['id'],2026,json.dumps(source,ensure_ascii=False),json.dumps(payload,ensure_ascii=False)))
        db.execute('DELETE FROM offering_occurrences WHERE academic_year=2026')
        for i,row in enumerate(extracted['rows']):
            db.execute('INSERT INTO offering_occurrences VALUES (?,?,?,?,?,?,?)',(f"{row['sourceId']}:{row['page']}:{i}",2026,row['sourceId'],row['page'],row['lectureCode'],int(row['canonical']),json.dumps(row,ensure_ascii=False)))
        db.execute('DELETE FROM scheduled_offerings WHERE academic_year=2026')
        db.executemany('INSERT INTO scheduled_offerings VALUES (?,?,?,?)',[(c['id'],2026,c['lectureCode'],json.dumps(c,ensure_ascii=False)) for c in classes])
        db.execute('INSERT INTO offering_imports VALUES (?,?) ON CONFLICT(academic_year) DO UPDATE SET payload_json=excluded.payload_json',(2026,json.dumps(dict(audit=audit,corrections=changes,globalOrCorrectionOnly=missing_changes,catalog=catalog),ensure_ascii=False)))
    (ROOT/'docs/offerings-2026-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in audit.items() if k!='documents'},ensure_ascii=False))


if __name__=='__main__':
    import_data()
