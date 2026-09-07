"""Recover the printed required/elective columns, keeping parallel columns separate."""
import re
import json
from pathlib import Path
from classify_pdf_courses import cell_text


SHARED_2022_SHA = 'ab162d3f0c06751973669b9bf6936067935e8b9b5daeacf470e96015ab365816'
SHARED_DEPARTMENTS = ['kikai', 'kikai_system', 'denki', 'iyo', 'ouyou_kagaku',
                      'genshiryoku', 'shizen_shizen', 'shizen_suuri']
SPREADS = json.loads(Path(__file__).with_name('requirement_spreads.json').read_text(encoding='utf8'))
REGIONS = json.loads(Path(__file__).with_name('requirement_regions.json').read_text(encoding='utf8'))


def read_shared_2022_requirement(course, cells, chars, header_cells=None):
    """Join the visually checked p10/p11 spread by the original row geometry.

    This is deliberately source-specific: arbitrary adjacent pages do not form
    a course table. The right-hand page also supplies numbering and restrictions.
    """
    spread = SPREADS.get(course['sourceId'])
    if not spread or course['page'] != spread['titlePage'] or course['verification']['sourceSha256'] != spread['sourceSha256']:
        raise ValueError('Shared requirement spread does not match the reviewed PDF')
    title = course['verification']['titleBbox']
    y = (title[1] + title[3]) / 2
    if header_cells is None:
        header_cells = {cell_text(chars, box): box for box in cells if box[3] < y}
    code_header = header_cells['科目ナンバリング']
    code_boxes = [box for box in cells if box[1] < y < box[3] and abs(box[0]-code_header[0]) < .5 and abs(box[2]-code_header[2]) < .5]
    if len(code_boxes) != 1:
        raise ValueError('Shared course row has no unique numbering cell')
    code_box = code_boxes[0]
    code = cell_text(chars, code_box)
    if not re.fullmatch(r'(?:10|SE)-[0-9A-C]{3}', code):
        raise ValueError('Shared course row numbering is invalid')
    header = header_cells['必選の別']
    projected = dict(course, verification=dict(course['verification'], titleBbox=[0, title[1], 1, title[3]]))
    result = read_requirement_columns(projected, cells, chars, [header])
    if result is None or len(result['options']) != len(SHARED_DEPARTMENTS):
        raise ValueError('Shared course row does not have eight department columns')
    note_header = header_cells['備考']
    notes = [box for box in cells if box[1] < y < box[3] and abs(box[0]-note_header[0]) < .5 and abs(box[2]-note_header[2]) < .5]
    for option, department in zip(result['options'], SHARED_DEPARTMENTS):
        option['departmentId'] = department
    return dict(result, page=11, titlePage=10, method='reviewed_spread_aligned_numbered_row',
                courseCode=code, courseCodeBbox=list(code_box),
                restrictions=' '.join(cell_text(chars, box) for box in notes))


def requirement_headers(cells, chars):
    # A page may contain two curriculum tables. Each course selects its own
    # preceding header; filtering by the first course loses the second table.
    return [box for box in cells
            if cell_text(chars, box) in {'必選の別', '必選の', '必選', '必修選択'}]


def read_program_marks(course, chars, requirement_header, program_headers):
    title = course['verification']['titleBbox']
    boxes = [(title[2], title[1], requirement_header[0], title[3], None)]
    boxes.extend((header[0], title[1], header[2], title[3], header) for header in program_headers if header[3] < title[1])
    marks = []
    for left, top, right, bottom, header in boxes:
        if left >= right:
            continue
        box = (left, top, right, bottom)
        text = cell_text(chars, box)
        symbols = re.findall(r'※(DS|MS)', text) if header is None else re.findall(r'^(?:※)?(DS|MS)$', text)
        marks.extend(dict(symbol=symbol, bbox=list(box), headerBbox=list(header) if header else None,
                          method='printed-program-column' if header else 'printed-title-annotation') for symbol in symbols)
    return marks


def read_requirement_columns(course, cells, chars, headers):
    title = course['verification']['titleBbox']
    y = (title[1] + title[3]) / 2
    region = next((region for region in REGIONS if region['sourceId'] == course.get('sourceId')
                   and region['page'] == course['page'] and region.get('yMin', 0) < y < region.get('yMax', 10000)), None)
    if region:
        if region['sourceSha256'] != course['verification']['sourceSha256']:
            raise ValueError('Reviewed requirement column PDF changed')
        boxes = [(left, title[1], right, title[3]) for left, right in zip(region['xEdges'], region['xEdges'][1:])]
        return requirement_options(course, boxes, chars, region['headerBbox'], region['method'])
    headers = [box for box in headers if box[3] < y and box[0] > title[0]]
    if not headers:
        return None
    header = max(headers, key=lambda box: box[3])
    body_columns = sorted(box for box in cells if box[1] < y < box[3]
                          and box[0] >= header[0] - .5 and box[2] <= header[2] + .5)
    if len(body_columns) > 1 and abs(body_columns[0][0] - header[0]) < .5 and abs(body_columns[-1][2] - header[2]) < .5 and all(abs(a[2] - b[0]) < .5 for a, b in zip(body_columns, body_columns[1:])):
        boxes = [(box[0], title[1], box[2], title[3]) for box in body_columns]
        return requirement_options(course, boxes, chars, header, 'partitioned_body_columns_at_verified_title_row')
    children = sorted(box for box in cells if box[0] >= header[0] - .5 and box[2] <= header[2] + .5
                      and abs(box[1] - header[3]) < .5 and box[3] < y
                      and re.fullmatch(r'[1-8]', cell_text(chars, box)))
    if children and abs(children[0][0] - header[0]) < .5 and abs(children[-1][2] - header[2]) < .5:
        boxes = [(box[0], title[1], box[2], title[3]) for box in children]
        return requirement_options(course, boxes, chars, header, 'numbered_header_columns_at_verified_title_row')
    if not children and header[2] - header[0] <= 30:
        boxes = [(header[0], title[1], header[2], title[3])]
        return requirement_options(course, boxes, chars, header, 'single_header_column_at_verified_title_row')
    boxes = sorted(box for box in cells if box[1] < y < box[3]
                   and box[0] >= header[0] - .5 and box[2] <= header[2] + .5)
    method = 'body_cells'
    if not boxes:
        children = sorted(box for box in cells if box[0] >= header[0] - .5 and box[2] <= header[2] + .5
                          and abs(box[1] - header[3]) < .5 and box[3] < y
                          and re.fullmatch(r'[1-8]', cell_text(chars, box)))
        if children and abs(children[0][0] - header[0]) < .5 and abs(children[-1][2] - header[2]) < .5:
            boxes = [(box[0], title[1], box[2], title[3]) for box in children]
            method = 'numbered_header_columns_at_verified_title_row'
        elif not children and header[2] - header[0] <= 30:
            boxes = [(header[0], title[1], header[2], title[3])]
            method = 'single_header_column_at_verified_title_row'
    if not boxes or any(a[2] > b[0] + .5 for a, b in zip(boxes, boxes[1:])):
        return None
    return requirement_options(course, boxes, chars, header, method)


def requirement_options(course, boxes, chars, header, method):
    options = []
    for index, box in enumerate(boxes):
        raw_symbol = cell_text(chars, box)
        if not re.fullmatch(r'(?:[○〇]※?|※[○〇]|△[0-9]*|[☆★]|)', raw_symbol):
            return None
        symbol = raw_symbol.replace('※', '')
        # An empty mark does not establish eligibility: shaded cells and course
        # restrictions must also be resolved before declaring an elective.
        course_type = 'required' if symbol in {'○', '〇'} else 'elective-required' if symbol.startswith('△') else 'designated' if symbol else 'unmarked'
        options.append(dict(column=index + 1, printedSymbol=symbol, rawPrintedSymbol=raw_symbol,
                            courseType=course_type, bbox=list(box)))
    title = course['verification']['titleBbox']
    annotations = [dict(symbol='*', bbox=list(char['bbox'])) for char in chars
                   if char['c'] in {'*', '＊'} and title[2] <= char['bbox'][0] < header[0]
                   and title[1] < (char['bbox'][1] + char['bbox'][3]) / 2 < title[3]]
    return dict(status='pdf_requirement_cells_checked', sourceSha256=course['verification']['sourceSha256'],
                page=course['page'], method=method, headerBbox=list(header), options=options, titleAnnotations=annotations)
