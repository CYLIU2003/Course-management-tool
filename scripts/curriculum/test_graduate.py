"""Validate graduate coverage against the stored original evidence, not UI counts."""

import hashlib
import json
import unittest

from backend.database import ROOT, connect
from backend.server import read_document
from scripts.curriculum.import_graduate import master_research_courses, recover_unicode
import pymupdf


class GraduateEvidenceTests(unittest.TestCase):
    def test_each_annual_research_table_has_all_five_areas_and_ten_credits(self):
        catalog = json.loads((ROOT / 'public/handbooks/graduate-catalog.json').read_text(encoding='utf8'))['documents']
        for year in range(2022, 2027):
            source = next(s for s in catalog if s['year'] == year and s['faculty'] == '環境情報学研究科'
                          and s['label'] == ('環境情報学専攻' if year <= 2024 else '教育課程表'))
            with pymupdf.open(ROOT / 'public' / source['localPath'].lstrip('/')) as pdf:
                recover_unicode(pdf)
                courses = master_research_courses(pdf, source)
            self.assertEqual(len(courses), 30, year)
            areas = {c['researchArea'] for c in courses}
            self.assertEqual(len(areas), 5, year)
            for area in areas:
                selected = [c for c in courses if c['researchArea'] == area]
                self.assertEqual(sum(c['credits'] for c in selected), 10, (year, area))
                self.assertEqual(len({c['title'] for c in selected}), 6, (year, area))

    def test_sources_and_every_available_cohort(self):
        catalog = json.loads(
            (ROOT / "public/handbooks/graduate-catalog.json").read_text(
                encoding="utf-8"
            )
        )
        with connect() as db:
            records = {}
            for source in catalog["documents"]:
                original = ROOT / "public" / source["localPath"].lstrip("/")
                self.assertEqual(
                    hashlib.sha256(original.read_bytes()).hexdigest(), source["sha256"]
                )
                document = read_document(db, source["id"])
                self.assertEqual(len(document["pages"]), source["pageCount"])
                for course in document["courses"]:
                    records[course["id"]] = (source, course)
            cohorts = db.execute(
                "SELECT payload_json FROM cohort_datasets WHERE department_id LIKE 'grad_%'"
            ).fetchall()
            self.assertEqual(len(cohorts), 87)
            for row in cohorts:
                cohort = json.loads(row[0])
                self.assertTrue(
                    cohort["courses"], (cohort["departmentId"], cohort["entranceYear"])
                )
                self.assertTrue(cohort["referenceOnly"])
                requirements = cohort['graduateRequirements']
                if requirements['creditBasis'] == 'credits':
                    for category in requirements['categories']:
                        available = sum(course['credits'] for course in cohort['courses']
                                        if course.get('degreeCategory') in category.get('courseCategories', [category['name']]))
                        self.assertGreaterEqual(available, category['minimumCredits'], (cohort['departmentId'], cohort['entranceYear'], category['name']))
                seen = set()
                for candidate in cohort["courses"]:
                    source_id = candidate["id"].removeprefix(
                        "reference-" + cohort["departmentId"] + "-"
                    )
                    source, evidence = records[source_id]
                    self.assertEqual(source["year"], cohort["entranceYear"])
                    self.assertEqual(evidence["studyLevel"], cohort["studyLevel"])
                    self.assertEqual(
                        evidence["verification"]["status"], "pdf_position_checked"
                    )
                    self.assertEqual(
                        evidence["verification"]["sourceSha256"], source["sha256"]
                    )
                    self.assertEqual(candidate["credits"], evidence["credits"])
                    if requirements['creditBasis'] == 'credits':
                        self.assertTrue(candidate.get('degreeCategory'), candidate['id'])
                    if cohort['departmentId'] == 'grad_master_international':
                        self.assertEqual(evidence['providerEvidence']['sourceSha256'], source['sha256'])
                        self.assertIn(evidence['providerEvidence']['university'], ['本学', 'エディスコーワン大学'])
                    self.assertNotIn((candidate["title"], candidate["credits"]), seen)
                    seen.add((candidate["title"], candidate["credits"]))
                    if candidate["credits"] == 0:
                        self.assertEqual(evidence["creditBasis"], "not_credit_based")


if __name__ == "__main__":
    unittest.main()
