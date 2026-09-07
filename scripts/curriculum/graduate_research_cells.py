"""Recover graduate research rows from explicit required-course/total headers."""
import re
import json
import copy
from pathlib import Path
import pymupdf
from course_titles import compact

ROOT = Path(__file__).resolve().parents[2]


def graduate_course_category(course, course_type, level, slug):
    """Map an explicitly required research course to its named degree block."""
    if course.get('creditBasis') == 'not_credit_based' or slug == 'international':
        return None
    title = compact(course['title'])
    research_role = next((role for role in ['文献研究・演習', '特別研究', '特殊研究', '講究', '研究', '実習', '演習']
                          if re.search(re.escape(role) + r'(?:[IV]+|[1-4])?$', title)), None)
    if research_role:
        if course_type not in {'required', 'elective-required'} and level != 'doctor':
            return '授業科目' if level == 'master' else None
        return '実習・演習' if research_role in {'実習', '演習'} else research_role
    return '授業科目' if level == 'master' else None


def graduate_degree_requirement(slug, level, year, all_data):
    """Select only the annual, visually reviewed source for this graduate cohort."""
    registry = json.loads((ROOT / 'data/verified/graduate_degree_minima.json').read_text(encoding='utf8'))['sources']
    family = slug if slug in {'kankyo', 'toshi', 'international', 'data'} else 'sougou'
    if family == 'toshi' and year <= 2024:
        family = 'kankyo'
    row = next(value for value in registry if value['scope'] == family and value['year'] == year)
    evidence = row['evidence']
    source = next(source for source, _ in all_data if source['id'] == evidence['sourceId'])
    if source['year'] != year or source['sha256'] != evidence['sourceSha256']:
        raise ValueError('Graduate degree source no longer matches its annual evidence')
    if slug == 'genshiryoku' and level == 'doctor':
        activities = [(source, course) for source, data in all_data if source['year'] == year
                      for course in data['courses'] if course.get('creditBasis') == 'not_credit_based'
                      and course.get('verification', {}).get('scope') == '共同原子力専攻']
        if not activities:
            raise ValueError('Non-credit doctorate needs original research-activity evidence')
        source, course = activities[0]
        return dict(creditBasis='not_credit_based', totalCredits=None, categories=[], issues=[],
                    activities=[dict(id=course['id'], title=course['title']) for _, course in activities],
                    evidence=dict(sourceId=source['id'], sourceSha256=source['sha256'], page=course['page'], method='original-non-credit-doctoral-table'))
    selected = row['jointNuclearMaster'] if slug == 'genshiryoku' and level == 'master' else row[level]
    result = copy.deepcopy(selected)
    for category in result['categories']:
        if level == 'doctor' and category['name'] == '研究':
            category['courseCategories'] = ['研究', '特殊研究']
    result.update(creditBasis='credits', evidence=evidence, issues=row['issues'] if level == 'master' else [])
    if slug == 'international':
        result['researchCreditsWithinTcu'] = row['researchCreditsWithinTcu']
    return result


def master_research_courses(pdf, source):
    courses = []
    for page_index, page in enumerate(pdf):
        if '文献研究' not in compact(page.get_text()):
            continue
        for table_index, table in enumerate(page.find_tables().tables):
            rows = table.extract()
            if len(rows) < 3:
                continue
            headers = [compact(value or '') for value in rows[0]]
            if not all(label in headers for label in ['専攻名', '領域', '必修科目']):
                continue
            major_column, area_column, title_column = (headers.index(label) for label in ['専攻名', '領域', '必修科目'])
            totals = [index for index, value in enumerate(rows[1]) if compact(value or '') == '計']
            if not totals:
                totals = [index + 2 for index, value in enumerate(headers) if '1年次2年次計' in value]
            if len(totals) != 1:
                raise ValueError('Graduate research table needs one total-credit column')
            credit_column = totals[0]
            credit_regions = {tuple(row.cells[credit_column]) for row in table.rows if row.cells[credit_column]}
            major = area = None
            for row_index, row in enumerate(rows[2:], 2):
                boxes = table.rows[row_index].cells
                if row[major_column]:
                    major = compact(row[major_column])
                if row[area_column]:
                    area = compact(row[area_column])
                title_box = boxes[title_column]
                if not row[title_column] or not title_box:
                    continue
                y = (title_box[1] + title_box[3]) / 2
                matching_credits = [box for box in credit_regions if box[1] < y < box[3]]
                if len(matching_credits) != 1:
                    raise ValueError('Graduate research credit column is not unique at the title row')
                original_credit = matching_credits[0]
                credit_box = (original_credit[0], title_box[1], original_credit[2], title_box[3])
                title = compact(row[title_column])
                credit = compact(page.get_textbox(pymupdf.Rect(credit_box)))
                if not major or not area or not re.fullmatch(r'[1-9](?:\.5)?', credit):
                    raise ValueError(f'Graduate research row is missing scope or credits: {source["id"]} p{page_index+1} row{row_index} {major}/{area} {title} [{credit}]')
                if compact(page.get_textbox(pymupdf.Rect(title_box))) != title or compact(page.get_textbox(pymupdf.Rect(credit_box))) != credit:
                    raise ValueError('Graduate research cells disagree with original PDF text')
                scope = major if major.endswith('専攻') else major + '専攻'
                proof = dict(status='pdf_position_checked', scope=scope, sourceSha256=source['sha256'],
                             titleText=title, titleBbox=list(title_box), creditsBbox=list(credit_box))
                courses.append(dict(id=f"{source['id']}:master-research:{page_index+1}:{table_index}:{row_index}",
                    sourceId=source['id'], page=page_index+1, table=table_index, row=row_index,
                    title=title, credits=float(credit), category='必修科目', group=area,
                    rawRequired='必修科目', courseType='required', sourceCode='', studyLevel='master',
                    status='extracted_reference', rawCells=row, extractionMethod='required_research_table_cells',
                    verification=proof, researchArea=area,
                    classification=dict(status='pdf_cell_checked', sourceSha256=source['sha256'],
                        path=[dict(label='必修科目', bbox=list(table.rows[0].cells[title_column]))],
                        scope=scope, page=page_index+1, method='explicit-required-course-header'),
                    requiredEvidence=dict(sourceSha256=source['sha256'], page=page_index+1,
                        headerBbox=list(table.rows[0].cells[title_column]), label='必修科目')))
    return courses
