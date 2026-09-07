"""Validate graduate coverage against the stored original evidence, not UI counts."""

import hashlib
import json
import unittest

from backend.database import ROOT, connect
from backend.server import read_document


class GraduateEvidenceTests(unittest.TestCase):
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
                    self.assertNotIn((candidate["title"], candidate["credits"]), seen)
                    seen.add((candidate["title"], candidate["credits"]))
                    if candidate["credits"] == 0:
                        self.assertEqual(evidence["creditBasis"], "not_credit_based")


if __name__ == "__main__":
    unittest.main()
