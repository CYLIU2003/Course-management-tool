"""Import graduate source evidence and position-checked course candidates into SQLite."""

import sys, json, hashlib, re
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.database import connect, encode
from verify_pdf_courses import verify_row, all_chars, credit_anchors
from pdf_unicode import recover_unicode
from course_titles import compact
from graduate_classification import classify_graduate_courses
from graduate_research_cells import master_research_courses, graduate_degree_requirement, graduate_course_category
from classify_pdf_courses import cell_text

MAJORS = [
    ("kikai", "機械専攻", "sougou", "総合理工学研究科"),
    ("denki_kagaku", "電気・化学専攻", "sougou", "総合理工学研究科"),
    ("genshiryoku", "共同原子力専攻", "sougou", "総合理工学研究科"),
    ("shizen", "自然科学専攻", "sougou", "総合理工学研究科"),
    ("kenchiku", "建築都市デザイン専攻", "sougou", "総合理工学研究科"),
    ("joho", "情報専攻", "sougou", "総合理工学研究科"),
    ("kankyo", "環境情報学専攻", "kankyo", "環境情報学研究科"),
    ("toshi", "都市生活学専攻", "kankyo", "環境情報学研究科"),
    (
        "international",
        "東京都市大学・エディスコーワン大学 国際連携環境融合科学専攻",
        "kankyo",
        "環境情報学研究科",
    ),
    ("data", "情報データ科学専攻", "data", "情報データ科学研究科"),
]


def verify_graduate_cell(course, page, source, tables):
    """Validate separate title/credit cells, retaining explicit campus annotations as evidence."""
    if course["table"] >= len(tables):
        return None
    table = tables[course["table"]]
    rows = table.extract()
    if course["row"] >= len(rows):
        return None
    header = rows[0]
    title_col = next(
        (i for i, v in enumerate(header) if compact(v or "") in ("授業科目", "科目名")),
        None,
    )
    credit_col = next(
        (i for i, v in enumerate(header) if compact(v or "") in ("単位", "単位数")),
        None,
    )
    if title_col is None or credit_col is None:
        return None
    boxes = table.rows[course["row"]].cells
    title_box, credit_box = boxes[title_col], boxes[credit_col]
    if not title_box or not credit_box:
        return None
    raw_title = compact(page.get_textbox(pymupdf.Rect(title_box)))
    raw_credit = compact(page.get_textbox(pymupdf.Rect(credit_box)))
    expected = compact(rows[course["row"]][title_col] or "")
    if (
        raw_title != expected
        or not re.fullmatch(r"[1-9](?:\.5)?", raw_credit)
        or float(raw_credit) != course["credits"]
    ):
        return None
    title = re.sub(r"(?:YC|SC)開講", "", raw_title)
    if not title:
        return None
    return dict(
        status="pdf_position_checked",
        scope=source["faculty"],
        titleText=title,
        sourceSha256=source["sha256"],
        titleBbox=title_box,
        creditsBbox=credit_box,
        rawTitle=raw_title,
    )


def international_courses(pdf, source):
    result = []
    scope = next(name for slug, name, _, _ in MAJORS if slug == "international")
    for pi, page in enumerate(pdf):
        heading = compact(page.get_text())[:450]
        if "教育課程表" not in heading or "国際連携環境融合科学専攻" not in heading:
            continue
        chars = all_chars(page)
        for ti, table in enumerate(page.find_tables().tables):
            rows = table.extract()
            if not rows:
                continue
            title_col = next(
                (i for i, v in enumerate(rows[0]) if "授業科目" in compact(v or "")),
                None,
            )
            total_col = next(
                (
                    i
                    for row in rows[:2]
                    for i, v in enumerate(row)
                    if compact(v or "") == "計"
                ),
                None,
            )
            if total_col is None:
                total_col = next(
                    (
                        i + 2
                        for i, v in enumerate(rows[0])
                        if "1年次2年次計" in compact(v or "")
                    ),
                    None,
                )
            if title_col is None or total_col is None:
                continue
            provider_col = next((i for i, value in enumerate(rows[0]) if '開設大学' in compact(value or '') or compact(value or '') == '備考'), None)
            category = ""
            for ri, row in enumerate(rows[2:], 2):
                if title_col:
                    category = compact(row[0]) if row[0] else category
                boxes = table.rows[ri].cells
                if total_col >= len(boxes):
                    continue
                tb, cb = boxes[title_col], boxes[total_col]
                if not tb or not cb:
                    continue
                title = row[title_col] or ""
                credit = compact(row[total_col] or "")
                if not title or not re.fullmatch(r"[0-9](?:\.5)?", credit):
                    continue
                if (
                    cell_text(chars, tb) != compact(title)
                    or cell_text(chars, cb) != credit
                ):
                    continue
                provider_box = boxes[provider_col] if provider_col is not None else None
                if provider_box:
                    # The 2026 vertical border intersects the first provider glyph.
                    provider_box = [provider_box[0] - 8, *provider_box[1:]]
                provider_text = cell_text(chars, provider_box) if provider_box else ''
                university = 'エディスコーワン大学' if 'エディスコーワン大学' in provider_text else '本学' if '本学' in provider_text or any(label in provider_text for label in ['環境情報学専攻', '総合理工学研究科']) else None
                if not university:
                    raise ValueError(f'International course provider lacks original evidence: {source["id"]} p{pi+1} {title}: {provider_text!r}')
                title = " ".join(title.split())
                result.append(
                    dict(
                        id=f"{source['id']}:international:{pi+1}:{ti}:{ri}",
                        title=title,
                        credits=float(credit),
                        creditBasis='not_credit_based' if float(credit) == 0 else 'credits',
                        providerEvidence=dict(university=university, text=provider_text, bbox=provider_box, page=pi + 1, sourceSha256=source['sha256'], method='original-provider-column'),
                        category=category or "関連科目",
                        group='他専攻・他研究科開講科目' if compact(rows[0][provider_col]) == '備考' else '本専攻開講科目',
                        rawRequired="",
                        courseType="unknown",
                        sourceCode="",
                        sourceId=source["id"],
                        page=pi + 1,
                        table=ti,
                        row=ri,
                        status="extracted_reference",
                        rawCells=row,
                        studyLevel="master",
                        verification=dict(
                            status="pdf_position_checked",
                            scope=scope,
                            titleText=title,
                            sourceSha256=source["sha256"],
                            titleBbox=tb,
                            creditsBbox=cb,
                        ),
                    )
                )
    return result


def doctoral_courses(pdf, source):
    """Verify doctorate titles against the total-credit column at the same vertical position."""
    result = []
    for page_index, page in enumerate(pdf):
        text = compact(page.get_text())
        if "博士後期課程" not in text and not (
            "共同原子力" in text and "単位制による科目の授業は行わない" in text
        ):
            continue
        lines = [
            line
            for block in page.get_text("dict")["blocks"]
            for line in block.get("lines", [])
        ]
        for ti, table in enumerate(page.find_tables().tables):
            rows = table.extract()
            if not rows:
                continue
            total_col = next(
                (
                    i
                    for row in rows[:3]
                    for i, value in enumerate(row)
                    if compact(value or "") == "計"
                ),
                None,
            )
            if total_col is not None:
                total_box = next(
                    (
                        row.cells[total_col]
                        for row in table.rows
                        if row.cells[total_col]
                    ),
                    None,
                )
                if not total_box:
                    continue
                for li, line in enumerate(lines):
                    title = compact("".join(span["text"] for span in line["spans"]))
                    box = line["bbox"]
                    cy = (box[1] + box[3]) / 2
                    if not table.bbox[1] < cy < table.bbox[3]:
                        continue
                    scope = next(
                        (
                            name
                            for _, name, _, faculty in MAJORS
                            if faculty == source["faculty"]
                            and re.fullmatch(
                                (
                                    "(?:建築都市デザイン|建築・都市)"
                                    if name == "建築都市デザイン専攻"
                                    else re.escape(compact(name).removesuffix("専攻"))
                                )
                                + r"(?:講究|特殊研究)[IVX]+",
                                title,
                            )
                        ),
                        None,
                    )
                    if not scope:
                        continue
                    credit_box = next(
                        (
                            row.cells[total_col]
                            for row in table.rows
                            if row.cells[total_col]
                            and row.cells[total_col][1] < cy < row.cells[total_col][3]
                        ),
                        None,
                    )
                    if not credit_box:
                        continue
                    credit = compact(page.get_textbox(pymupdf.Rect(credit_box)))
                    if not re.fullmatch(r"[1-9]", credit):
                        continue
                    result.append(
                        dict(
                            id=f"{source['id']}:doctor:{page_index+1}:{ti}:{li}",
                            title=title,
                            credits=int(credit),
                            category=scope,
                            group="講究" if "講究" in title else "研究",
                            rawRequired="必修",
                            courseType="unknown",
                            sourceCode="",
                            sourceId=source["id"],
                            page=page_index + 1,
                            table=ti,
                            row=li,
                            status="extracted_reference",
                            rawCells=[title, credit],
                            studyLevel="doctor",
                            verification=dict(
                                status="pdf_position_checked",
                                scope=scope,
                                titleText=title,
                                sourceSha256=source["sha256"],
                                titleBbox=box,
                                creditsBbox=credit_box,
                            ),
                        )
                    )
            elif (
                "共同原子力" in text
                and "単位制による科目の授業は行わない" in text
                and "研究指導科目" in compact("".join(v or "" for v in rows[0]))
            ):
                for ri, row in enumerate(rows[2:], 2):
                    title = compact(row[1] or "")
                    box = table.rows[ri].cells[1]
                    if (
                        not title
                        or not box
                        or compact(page.get_textbox(pymupdf.Rect(box))) != title
                    ):
                        continue
                    result.append(
                        dict(
                            id=f"{source['id']}:doctor:{page_index+1}:{ti}:{ri}",
                            title=title,
                            credits=0,
                            category="共同原子力専攻",
                            group="単位制によらない研究指導",
                            rawRequired="",
                            courseType="unknown",
                            sourceCode=row[2] or "",
                            sourceId=source["id"],
                            page=page_index + 1,
                            table=ti,
                            row=ri,
                            status="extracted_reference",
                            rawCells=row,
                            studyLevel="doctor",
                            creditBasis="not_credit_based",
                            verification=dict(
                                status="pdf_position_checked",
                                scope="共同原子力専攻",
                                titleText=title,
                                sourceSha256=source["sha256"],
                                titleBbox=box,
                                creditBasis="not_credit_based",
                            ),
                        )
                    )
    return result


def main():
    catalog = json.loads(
        (ROOT / "public/handbooks/graduate-catalog.json").read_text(encoding="utf8")
    )
    all_data = []
    for source in catalog["documents"]:
        path = ROOT / "public" / source["extractedPath"].lstrip("/")
        data = json.loads(path.read_text(encoding="utf8"))
        pdf_path = ROOT / "public" / source["localPath"].lstrip("/")
        if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("Graduate source hash mismatch")
        data["courses"] = [
            c
            for c in data["courses"]
            if ":doctor:" not in c["id"] and ":international:" not in c["id"] and ":master-research:" not in c["id"]
        ]
        by_page = {}
        for course in data["courses"]:
            by_page.setdefault(course["page"], []).append(course)
        with pymupdf.open(pdf_path) as pdf:
            recover_unicode(pdf)
            for number, courses in by_page.items():
                page = pdf[number - 1]
                if page.rotation:
                    page.remove_rotation()
                chars = all_chars(page)
                words = page.get_text("words")
                anchors = credit_anchors(chars)
                tables = page.find_tables().tables
                heading = compact(page.get_text())[:500]
                level = (
                    "master"
                    if "博士前期課程" in heading or "修士課程" in heading
                    else "doctor" if "博士後期課程" in heading else None
                )
                for course in courses:
                    category = compact(course["category"])
                    scope = next(
                        (
                            name
                            for _, name, _, faculty in MAJORS
                            if faculty == source["faculty"]
                            and (
                                compact(name) == category
                                or (
                                    name == "建築都市デザイン専攻"
                                    and category == "建築・都市専攻"
                                )
                            )
                        ),
                        source["faculty"],
                    )
                    evidence = verify_row(
                        course,
                        words,
                        chars,
                        anchors,
                        scope if level else None,
                        source["sha256"],
                    )
                    if level and evidence["status"] != "pdf_position_checked":
                        evidence = (
                            verify_graduate_cell(course, page, source, tables)
                            or evidence
                        )
                    course["verification"] = evidence
                    course["studyLevel"] = level
                    if evidence["status"] == "pdf_position_checked":
                        course["title"] = evidence["titleText"]
            data["courses"].extend(doctoral_courses(pdf, source))
            if source["faculty"] == "環境情報学研究科":
                data["courses"].extend(international_courses(pdf, source))
            classify_graduate_courses(pdf, data)
            if source['faculty'] == '環境情報学研究科':
                data['courses'].extend(master_research_courses(pdf, source))
        data["dataPath"] = source["extractedPath"]
        data["level"] = "graduate"
        source.update(
            dataPath=source["extractedPath"], courseCount=len(data["courses"])
        )
        path.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf8"
        )
        all_data.append((source, data))
    departments = []
    datasets = []
    for slug, name, faculty_id, faculty in MAJORS:
        levels = ["master"] if slug == "international" else ["master", "doctor"]
        for level in levels:
            department = dict(
                id=f"grad_{level}_{slug}",
                name=name,
                faculty=faculty,
                facultyId="grad_" + faculty_id,
                campus="世田谷" if faculty_id == "sougou" else "横浜",
                studyLevel=level,
            )
            departments.append(department)
            for year in range(2022, 2027):
                sources = [
                    (s, d)
                    for s, d in all_data
                    if s["year"] == year and s["faculty"] == faculty
                ]
                if not sources:
                    continue
                if slug == "international" and year < 2024:
                    continue
                candidates = {}
                for source, data in sources:
                    for course in data["courses"]:
                        v = course.get("verification", {})
                        if (
                            v.get("status") != "pdf_position_checked"
                            or course.get("studyLevel") != level
                            or v.get("scope")
                            not in (
                                (name,) if slug == "international" else (name, faculty)
                            )
                        ):
                            continue
                        key = (compact(course["title"]), course["credits"])
                        category_proof = course.get('classification', {})
                        verified_path = category_proof.get('path', []) if category_proof.get('sourceSha256') == source['sha256'] else []
                        required_header = course.get('requiredEvidence', {})
                        required_columns = course.get('requirementEvidence', {})
                        options = required_columns.get('options', []) if required_columns.get('sourceSha256') == source['sha256'] else []
                        course_type = 'required' if required_header.get('sourceSha256') == source['sha256'] else options[0]['courseType'] if len(options) == 1 and options[0]['courseType'] in ('required', 'elective-required') else 'unknown'
                        if year in (2022, 2023) and level == 'master' and faculty == '総合理工学研究科' and re.fullmatch(r'29-5[YZ][0-9A-Z]', compact(course.get('sourceCode', ''))):
                            # The pre-2024 lists have no compulsory-mark column.
                            # Their research numbering, own-major scope and annual
                            # compulsory-research rule identify the research block.
                            course_type = 'elective-required' if slug == 'genshiryoku' else 'required'
                        if slug == 'genshiryoku' and options and '※' in options[0].get('rawPrintedSymbol', ''):
                            course_type = 'elective-required'
                        degree_category = graduate_course_category(course, course_type, level, slug)
                        if slug == 'international':
                            provider = course.get('providerEvidence', {})
                            if provider.get('sourceSha256') != source['sha256']:
                                raise ValueError('International course provider evidence missing')
                            degree_category = '本学開設科目' if provider['university'] == '本学' else 'エディスコーワン大学開設科目'
                            course_type = 'elective'
                        if degree_category == '授業科目':
                            course_type = 'elective'
                        candidates.setdefault(
                            key,
                            dict(
                                id=f"reference-{department['id']}-{course['id']}",
                                title=course["title"],
                                credits=course["credits"],
                                courseType=course_type,
                                category=verified_path[0]['label'] if verified_path else course['category'],
                                group=course.get("group", ""),
                                sourceKind="curriculum",
                                departmentId=department["id"],
                                curriculumYear=year,
                                tags=['指導教員の研究分野に対応する科目を履修'] if slug == 'genshiryoku' and course_type == 'elective-required' else ['他専攻履修の許可が必要'] if course.get('group') == '他専攻・他研究科開講科目' else [],
                                sourceDocumentId=source["id"],
                                sourcePage=course["page"],
                                degreeCategory=degree_category,
                            ),
                        )
                payload = dict(
                    status="partial",
                    referenceOnly=True,
                    departmentId=department["id"],
                    departmentName=name,
                    entranceYear=year,
                    studyLevel=level,
                    curriculum=dict(
                        name=name,
                        requiredCredits=0,
                        breakdown=dict(required=0, electiveRequired=0, elective=0),
                    ),
                    courses=list(candidates.values()),
                    applicableCourses=[],
                    graduateRequirements=graduate_degree_requirement(slug, level, year, all_data),
                )
                datasets.append(payload)
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "CREATE TABLE IF NOT EXISTS reference_activities (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE, record_json TEXT NOT NULL)"
        )
        for dep in departments:
            db.execute(
                "INSERT INTO faculties VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
                (dep["facultyId"], dep["faculty"]),
            )
            db.execute(
                "INSERT INTO departments VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
                (
                    dep["id"],
                    dep["facultyId"],
                    dep["name"]
                    + "（"
                    + ("博士前期" if dep["studyLevel"] == "master" else "博士後期")
                    + "）",
                ),
            )
        for source, data in all_data:
            db.execute("DELETE FROM source_documents WHERE id=?", (source["id"],))
            db.execute(
                "INSERT INTO source_documents VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    source["id"],
                    "handbook",
                    source["year"],
                    source["faculty"],
                    source["label"],
                    source["url"],
                    source["localPath"],
                    source["sha256"],
                    source["pageCount"],
                    encode(source),
                ),
            )
            for page in data["pages"]:
                db.execute(
                    "INSERT INTO source_pages VALUES (?,?,?,?)",
                    (source["id"], page["page"], page["text"], encode(page["topics"])),
                )
                for table in page["tables"]:
                    db.execute(
                        "INSERT INTO source_tables VALUES (?,?,?,?,?)",
                        (
                            source["id"],
                            page["page"],
                            table["index"],
                            encode(table["rows"]),
                            encode(table["bbox"]),
                        ),
                    )
            for course in data["courses"]:
                if course.get("creditBasis") == "not_credit_based":
                    db.execute(
                        "INSERT INTO reference_activities VALUES (?,?,?)",
                        (course["id"], source["id"], encode(course)),
                    )
                else:
                    db.execute(
                        "INSERT INTO course_records VALUES (?,?,?,?,?,?,?,?,?)",
                        (
                            course["id"],
                            source["id"],
                            course["page"],
                            course["title"],
                            course["credits"],
                            course["category"],
                            course["rawRequired"],
                            "extracted_reference",
                            encode(course),
                        ),
                    )
        for p in datasets:
            db.execute(
                "INSERT INTO cohort_datasets VALUES (?,?,?,?,?) ON CONFLICT(department_id,entrance_year) DO UPDATE SET status=excluded.status,course_count=excluded.course_count,payload_json=excluded.payload_json",
                (
                    p["departmentId"],
                    p["entranceYear"],
                    p["status"],
                    len(p["courses"]),
                    encode(p),
                ),
            )
    (ROOT / "src/core/graduate-departments.json").write_text(
        json.dumps(departments, ensure_ascii=False, indent=2), encoding="utf8"
    )
    (ROOT / "public/handbooks/graduate-catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf8"
    )
    report = dict(
        documents=len(all_data),
        pages=sum(len(d["pages"]) for _, d in all_data),
        rawCourses=sum(len(d["courses"]) for _, d in all_data),
        checkedCourses=sum(
            c.get("verification", {}).get("status") == "pdf_position_checked"
            for _, d in all_data
            for c in d["courses"]
        ),
        cohorts=[
            dict(
                departmentId=p["departmentId"],
                year=p["entranceYear"],
                courses=len(p["courses"]),
            )
            for p in datasets
        ],
    )
    (ROOT / "docs/graduate-coverage.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8"
    )
    print(json.dumps({k: v for k, v in report.items() if k != "cohorts"}))


if __name__ == "__main__":
    main()
