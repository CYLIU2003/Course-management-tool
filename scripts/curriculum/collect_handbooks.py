"""Download the officially linked undergraduate handbooks; retain provenance."""
import hashlib
import argparse
from functools import partial
import json
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import pymupdf as fitz
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'public/handbooks'
INDEX_URL = 'https://www.asc.tcu.ac.jp/syllabus_archives/'
HIRAMEKI_URL = 'https://hirameki.tcu.ac.jp/program/pdf/'


def discover():
    response = requests.get(INDEX_URL, timeout=60)
    response.raise_for_status()
    html = response.content.decode('utf-8')
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'source-index.html').write_text(html, encoding='utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    records = []
    for year in range(2022, 2027):
        heading = next(h for h in soup.find_all('h3') if h.text.strip().startswith(str(year)))
        section = heading.parent if year == 2026 else heading.find_next_sibling('div')
        faculty = ''
        for link in section.find_all('a', href=True):
            url = link['href']
            if not url.lower().endswith('.pdf'):
                continue
            label = link.get_text(strip=True).strip('＜＞')
            if label.endswith('学部'):
                faculty = label
            records.append(dict(kind='handbook', year=year, faculty=faculty, label=label, url=url, indexUrl=INDEX_URL))
        if sum(record['year'] == year for record in records) != (23 if year == 2022 else 24):
            raise ValueError(f'Handbook links changed for {year}; review archive coverage')
    return records


def discover_hirameki():
    response = requests.get(HIRAMEKI_URL, timeout=60)
    response.raise_for_status()
    html = response.content.decode('utf-8')
    (DEST / 'hirameki-source-index.html').write_text(html, encoding='utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    # The page labels distinguish admission cohorts, not PDF upload years.
    descriptions = {
        '1f1a3fbccfa9a0abdfecd08f554a176e.pdf': (2026, [2026], '2026年度入学'),
        '32f492be1326ea60be4ae3ea9fc2f6af.pdf': (2025, [2025], '2025年度入学 理工学部'),
        '58429a500560dda0fb299438a739c28f.pdf': (2025, [2025], '2025年度入学 他6学部'),
        '9cdbc5cecaf243dec3c4188f532ef68b.pdf': (2024, [2024], '2024年度入学 理工学部'),
        '762a7db6ca8f63cb9f8626a2b6d077f1.pdf': (2023, [2023], '2023年度入学 理工学部6学科（自然科学科以外）'),
        'for_student.pdf': (2022, [2021, 2022], '2021・2022年度入学 機械・機械システム・電気電子通信'),
    }
    links = [a for a in soup.find_all('a', href=True) if a['href'].lower().endswith('.pdf')]
    if len(links) != len(descriptions) or {a['href'].split('/')[-1] for a in links} != set(descriptions):
        raise ValueError('Hirameki leaflet links changed; review cohort labels before downloading.')
    return [dict(kind='hirameki', year=year, entranceYears=years, faculty='', label=label,
                 url=link['href'].replace('http://', 'https://', 1), indexUrl=HIRAMEKI_URL)
            for link in links for year, years, label in [descriptions[link['href'].split('/')[-1]]]]


def download(record, refresh=False):
    folder = 'hirameki/' if record['kind'] == 'hirameki' else ''
    relative = f"{folder}{record['year']}/{record['url'].split('/')[-1]}"
    path = DEST / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not path.exists():
        response = requests.get(record['url'], timeout=120)
        response.raise_for_status()
        if not response.content.startswith(b'%PDF-'):
            raise ValueError(f"Not a PDF: {record['url']}")
        temporary = path.with_suffix('.download')
        temporary.write_bytes(response.content)
        temporary.replace(path)
    record.update(localPath=f'/handbooks/{relative}', sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  bytes=path.stat().st_size, downloadedAt=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat())
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='Re-download existing URLs (back up source archive first)')
    arguments = parser.parse_args()
    records = discover() + discover_hirameki()
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(partial(download, refresh=arguments.refresh), records))
    # PyMuPDF is not thread-safe. Only network I/O is concurrent.
    for record in results:
        path = ROOT / 'public' / record['localPath'].lstrip('/')
        with fitz.open(path) as document:
            record['pageCount'] = len(document)
        print(f"{record['year']} {record['label']}: {record['pageCount']} pages", flush=True)
    (DEST / 'manifest.json').write_text(json.dumps(dict(schemaVersion=1, retrievedAt=datetime.now(timezone.utc).isoformat(), documents=results), ensure_ascii=False, indent=2), encoding='utf-8')
