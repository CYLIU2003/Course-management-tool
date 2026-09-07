"""Collect officially linked graduate sources with cohort and byte provenance."""

import hashlib, json, re
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import pymupdf
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_handbooks import download
from extract_handbooks import extract_document

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "public/handbooks"


def discover():
    records = []
    for url in [
        "https://www.asc.tcu.ac.jp/",
        "https://www.asc.tcu.ac.jp/syllabus_grad_archives/",
    ]:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        soup = BeautifulSoup(response.content.decode("utf-8"), "html.parser")
        sections = []
        if url.endswith("archives/"):
            sections = [
                (int(h.text[:4]), h.parent)
                for h in soup.select(".grad-year h3")
                if h.text[:4].isdigit() and 2022 <= int(h.text[:4]) <= 2025
            ]
        else:
            h = next(
                h
                for h in soup.find_all("h3")
                if "2026" in h.text and "履修要綱" in h.text
            )
            sections = [(2026, h.parent)]
        for year, section in sections:
            faculty = ""
            for node in section.descendants:
                if isinstance(node, str):
                    text = node.strip(" \n＜＞")
                    if text in [
                        "総合理工学研究科",
                        "環境情報学研究科",
                        "情報データ科学研究科",
                    ]:
                        faculty = text
                elif node.name == "a" and node.get("href", "").split("#")[
                    0
                ].lower().endswith(".pdf"):
                    label = node.get_text(strip=True)
                    if not faculty:
                        raise ValueError("Graduate faculty missing")
                    records.append(
                        dict(
                            kind="handbook",
                            level="graduate",
                            year=year,
                            faculty=faculty,
                            label=label,
                            url=urljoin(url, node["href"]).split("#")[0],
                            indexUrl=url,
                        )
                    )
    unique = {}
    for row in records:
        key = (row["year"], row["url"])
        if key not in unique:
            unique[key] = {**row, "labels": [row["label"]]}
        elif row["label"] not in unique[key]["labels"]:
            unique[key]["labels"].append(row["label"])
    return list(unique.values())


def main():
    records = discover()
    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(download, records))
    catalog = []
    for record in records:
        with pymupdf.open(ROOT / "public" / record["localPath"].lstrip("/")) as pdf:
            record["pageCount"] = len(pdf)
        data = extract_document(record)
        metadata = {
            k: v
            for k, v in data.items()
            if k not in ("pages", "courses", "issues", "unicodeRepairs")
        }
        metadata.update(
            extractedPath="/handbooks/extracted/" + data["id"] + ".json",
            courseCount=len(data["courses"]),
            tableCount=sum(len(p["tables"]) for p in data["pages"]),
            reviewIssueCount=len(data["issues"]),
        )
        catalog.append(metadata)
        print(
            record["year"],
            record["label"],
            record["pageCount"],
            len(data["courses"]),
            flush=True,
        )
    (BASE / "graduate-catalog.json").write_text(
        json.dumps(
            dict(
                schemaVersion=1,
                retrievedAt=datetime.now(timezone.utc).isoformat(),
                documents=catalog,
            ),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
