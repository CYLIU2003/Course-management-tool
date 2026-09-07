"""Add the reviewed admission-specific degree-table conditions to the registry.

The numeric series below are transcriptions of the five annual tables, not an
assumption that a current curriculum applies to earlier admission cohorts.
"""
import copy
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
YEARS = range(2022, 2027)
REGISTRY = ROOT / 'data/verified/undergraduate_degree_rules.json'

# Required credits in the foundation and specialist blocks, read in year order.
REQUIRED = {
    'kikai': ([13,16,16,16,17], [31,31,31,31,31]),
    'kikai_system': ([16,19,19,19,20], [34.5,34.5,34.5,34.5,34.5]),
    'denki': ([13,16,16,16,17], [32,32,32,32,32]),
    'iyo': ([13,16,16,16,19], [38,36,36,36,34]),
    'ouyou_kagaku': ([19,22,22,22,23], [30,30,30,30,30]),
    'genshiryoku': ([19,22,22,22,23], [22,22,22,22,22]),
    'shizen_shizen': ([15,18,18,18,19], [41,41,41,41,39]),
    'shizen_suuri': ([17,20,18,18,19], [32,32,34,34,34]),
    'kenchiku': ([15,18,18,18,19], [37,37,31,31,31]),
    'toshi_kogaku': ([15,18,18,18,19], [27,27,31,28,28]),
    'joho_kagaku': ([20,23,23,23,23], [36,36,36,42,42]),
    'chino_joho': ([15,18,18,18,18], [26,26,23,23,23]),
    'kankyo_sosei': ([4,8,8,8,8], [20,20,20,20,20]),
    'kankyo_keiei': ([6,10,10,10,10], [12,12,12,12,12]),
    'shakai_media': ([12,15,15,15,15], [10,10,10,10,10]),
    'joho_system': ([10,13,13,13,13], [27,27,27,27,27]),
}
PAGES = {
    'kikai': [7,7,7,9,9], 'kikai_system': [7,8,8,8,8],
    'denki': [9,9,9,9,9], 'iyo': [6,6,6,8,8],
    'ouyou_kagaku': [7,8,8,8,8], 'genshiryoku': [8,8,8,8,8],
    'shizen_shizen': [8,9,9,9,9], 'shizen_suuri': [9,10,10,10,10],
    'kenchiku': [7,8,8,8,8], 'toshi_kogaku': [7,7,7,9,9],
    'joho_kagaku': [7,7,7,9,9], 'chino_joho': [7,7,7,9,9],
    'kankyo_sosei': [97,97,92,94,95], 'kankyo_keiei': [112,113,107,109,108],
    'shakai_media': [92,91,89,90,91], 'joho_system': [108,107,105,106,105],
    'design_data': [0,76,74,77,78], 'toshi_seikatsu': [67,66,66,64,66],
    'ningen': [59,61,61,62,63],
}


def normalized(text):
    return re.sub(r'\s', '', unicodedata.normalize('NFKC', text))


def prepare():
    original = json.loads(REGISTRY.read_text(encoding='utf8'))['sets']
    catalog = json.loads((ROOT / 'public/handbooks/catalog.json').read_text(encoding='utf8'))['documents']
    departments = json.loads((ROOT / 'data/import/curricula.json').read_text(encoding='utf8'))['departments']
    department_map = {value['id']: value for value in departments}
    documents = {source['id']: json.loads((ROOT / 'public' / source['dataPath'].lstrip('/')).read_text(encoding='utf8')) for source in catalog}
    legends = []
    for source in catalog:
        if source['kind'] != 'handbook' or source['label'] != source['faculty']:
            continue
        for page in documents[source['id']]['pages']:
            text = normalized(page['text'])
            match = re.search(r'選択科目.{0,40}無印', text)
            if match:
                legends.append(dict(faculty=source['faculty'], year=source['year'], sourceId=source['id'],
                    sourceSha256=source['sha256'], page=page['page'], text=text[max(0,match.start()-90):match.end()+40]))
                break
    if len(legends) != 39:
        raise ValueError('Each faculty/admission year needs its own printed symbol definition')
    (ROOT / 'data/verified/course_symbol_legends.json').write_text(json.dumps(legends, ensure_ascii=False, indent=2), encoding='utf8')
    bases = {(rule['departmentId'], rule['entranceYear']): rule for rule in original}
    result = []
    for (department_id, year), base in sorted(bases.items()):
        department = department_map[department_id]
        index = year - 2022
        label = re.sub('（.*?）', '', department['name'])
        sources = [source for source in catalog if source['year'] == year and source['faculty'] == department['faculty'] and source['label'] == label]
        if not sources:
            sources = [source for source in catalog if source['year'] == year and source['faculty'] == department['faculty'] and source['label'] == department['faculty']]
        if len(sources) != 1:
            raise ValueError(f'Ambiguous degree condition source: {department_id}/{year}')
        source = sources[0]
        page_number = PAGES[department_id][index]
        page_text = normalized(documents[source['id']]['pages'][page_number-1]['text'])
        if not any(word in page_text for word in ['卒業要件','卒業','必修科目']):
            raise ValueError(f'The reviewed degree-table page changed: {department_id}/{year} {source["id"]} p{page_number}')
        evidence = dict(sourceId=source['id'], sourceSha256=source['sha256'], page=page_number, method='annual-degree-table-transcription')
        variants = [('standard','通常課程')]
        if department_id in ['joho_kagaku','chino_joho']:
            variants = [('general','一般コース'),('international','国際コース')]
        elif department_id == 'toshi_seikatsu' and year <= 2024:
            variants = [('creative','都市生活創造コース'),('international_urban','国際都市経営コース')]
        elif department_id == 'ningen' and year >= 2023:
            variants = [('child','児童学コース'),('human','人間総合科学コース')]
        for variant, label in variants:
            # Keep the separately verified top-level international minima.
            chosen = next((r for r in original if r['departmentId']==department_id and r['entranceYear']==year and r['variant']==variant), base)
            rule = copy.deepcopy(chosen)
            rule.update(id=f'{department_id}:{year}:{variant}', variant=variant, variantName=label, groups=[], conditions=[], detailEvidence=evidence)
            def group(category, symbols, minimum, *, name=None, course_group=None, course_categories=None):
                if not minimum:
                    return
                categories = course_categories or [category]
                rule['groups'].append(dict(id=f'{category}:{symbols}:{course_group or ""}:{"/".join(categories)}', category=category,
                    name=name or ('必修科目' if symbols=='○' else f'選択必修 {symbols}'),
                    symbols=symbols.split(','), minimumCredits=minimum,
                    membership='all_marked' if symbols=='○' else 'minimum',
                    courseGroup=course_group, courseCategories=categories, evidence=evidence))
            is_human = department_id == 'ningen'
            if department_id == 'design_data':
                for category, symbol, minimum in [('教養科目','△',6),('外国語科目','○',6),('外国語科目','△',4),
                    ('専門基礎科目','○',11),('専門基礎科目','△',20),('専門応用科目','○',4),('専門応用科目','△',2)]:
                    group(category,symbol,minimum)
            elif is_human:
                combined = '教養・外国語・体育科目' if year <= 2023 else None
                def human_group(category,symbol,minimum):
                    group(combined or category,symbol,minimum,name=f'{category}の'+('必修' if symbol=='○' else '選択必修'),course_categories=[category])
                if year <= 2023:
                    human_group('教養科目','○',4 if variant=='human' else 2)
                human_group('外国語科目','○',4)
                if year <= 2023:
                    human_group('体育科目','○',2 if variant=='human' else 4)
                    if variant=='human': human_group('体育科目','△',1)
                    group('専門科目','○',22 if year==2022 else 39)
                    if year==2022: group('PBL科目','○',2)
                else:
                    human_group('体育科目','△' if variant=='human' else '○',1 if variant=='human' else 2)
                    group('専門基礎科目','○',(24 if variant=='human' else 22) if year==2026 else (25 if variant=='human' else 23))
                    group('専門科目','○',18 if year==2026 and variant=='human' else 20)
            else:
                group('外国語科目','○',4)
                group('体育科目','△',1)
                if year==2022:
                    group('PBL科目','○',4 if department['faculty']=='環境学部' else 3)
                if variant=='international':
                    group('外国語科目','*',8,name='国際コース指定科目（*印）')
                if department_id=='toshi_seikatsu':
                    group('専門基礎科目','○',[21,24,24,23,23][index])
                    group('専門基礎科目','△',16)
                    group('専門基礎科目','△',4 if variant=='international_urban' else 8,name='選択必修のうち演習領域',course_group='演習領域')
                    group('専門科目','○',12 if year==2022 else 10)
                    group('専門科目','△',10)
                    if variant=='international_urban':group('専門科目','☆',6,name='国際都市経営コース指定科目')
                else:
                    core = next(category['name'] for category in rule['categories'] if category['name'] in ['理工学基礎科目','学部基盤科目','情報工学基盤科目','専門基礎科目'])
                    a,b = REQUIRED[department_id]
                    international = variant=='international'
                    group(core,'○',a[index]+(2 if international else 0))
                    group('専門科目','○',b[index]+((6 if department_id=='chino_joho' else 2) if international else 0))
                    if department_id in ['kikai','denki','joho_kagaku','chino_joho']:
                        group(core,'△1',2 if international else 4);group(core,'△2',2)
                    elif department_id in ['ouyou_kagaku','genshiryoku']:
                        group(core,'△1',2);group(core,'△2',4 if department_id=='ouyou_kagaku' else 2)
                    elif department_id in ['kikai_system','iyo','shizen_shizen','shizen_suuri','kenchiku','toshi_kogaku']:
                        number={'kikai_system':7,'iyo':8 if year==2022 else 6,'shizen_shizen':6,'shizen_suuri':2 if year<=2023 else 4,'kenchiku':2,'toshi_kogaku':2}[department_id]
                        group(core,'△',number)
                    if department_id in ['kikai_system','denki','genshiryoku']:
                        values={'kikai_system':(10,1.5),'denki':(10,2),'genshiryoku':(8,4)}[department_id]
                        group('専門科目','△1',values[0]);group('専門科目','△2',values[1])
                    elif department_id in ['iyo','shizen_shizen','shizen_suuri','joho_system','joho_kagaku']:
                        number={'iyo':14 if year==2022 else 10,'shizen_shizen':14,'shizen_suuri':14 if year<=2023 else 12,'joho_system':2,'joho_kagaku':2 if year<=2024 else 0}[department_id]
                        group('専門科目','△',number)
                    elif department_id=='shakai_media':
                        group('専門科目','△1',4);group('専門科目','△2',4)
                    elif department_id=='toshi_kogaku':
                        group('専門科目','△1',[10,10,9,12,12][index])
                        for symbol in ['△2','△3','△4']:group('専門科目',symbol,4)
                    elif department_id=='kenchiku':
                        group('専門科目','△1',6 if year<=2023 else 5)
                        group('専門科目','△2',2 if year<=2023 else 1)
                        group('専門科目','△3',2)
                        group('専門科目','△1,△2,△3,△4',31 if year<=2023 else 35,name='選択必修△1～△4の合計')
            rule['coverage'] = 'category_and_group_minima'
            windows = [page_text[max(0, match.start()-130):match.start()+150] for match in re.finditer('DS', page_text)]
            program_windows = [text for text in windows if '4単位' in text and 'MS' in text]
            if not program_windows:
                raise ValueError(f'Missing original DS/MS requirement in {rule["id"]}')
            rule['conditions'].append(dict(id='ds-ms', name='数理・データサイエンスプログラム',
                kind='marked_credit_minimum', marks=['DS','MS'], minimumCredits=4,
                evidence=evidence, sourceText=program_windows[-1]))
            if any(re.search(r'DS(?:を)?1単位', text) for text in program_windows):
                rule['conditions'].append(dict(id='ds', name='うちデータサイエンス（DS）',
                    kind='marked_credit_minimum', marks=['DS'], minimumCredits=1,
                    evidence=evidence, sourceText=program_windows[-1]))
            if len({group['id'] for group in rule['groups']}) != len(rule['groups']):
                raise ValueError(f'Duplicate degree group in {rule["id"]}')
            rule['symbolLegend'] = next(legend for legend in legends if legend['faculty']==department['faculty'] and legend['year']==year)
            if department_id == 'design_data' and year == 2026:
                rule['excludedCategories'] = [dict(name=name, reason='教育課程表の備考に「卒業要件非加算」と明記されています。プログラムの履修記録として保持します。',
                    evidence=dict(sourceId=source['id'], sourceSha256=source['sha256'], page=82)) for name in ['ことづくり', 'ひらめきことづくり']]
            rule['sourceConflicts'] = []
            if rule['id'] == 'toshi_seikatsu:2025:standard':
                rule['sourceConflicts'].append(dict(
                    groupId='専門基礎科目:○::専門基礎科目', printedMinimum=23, markedCourseCredits=20,
                    message='原本内で不一致があります。修得条件表は必修23単位、教育課程表の○印は合計20単位です。空間デザイン演習(1)は△印・2単位と記載されています。訂正が確認できるまで、この区分の条件達成は判定しません。',
                    evidence=[dict(evidence, page=63, method='original-render-and-marked-course-sum'), dict(evidence, page=64, method='original-render-and-minimum-table')]))
            result.append(rule)
    REGISTRY.write_text(json.dumps(dict(schemaVersion=2,sets=result),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f'Prepared {len(result)} admission/course variants and {sum(len(r["groups"]) for r in result)} degree groups')


if __name__ == '__main__':
    prepare()
