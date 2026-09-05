"""Snapshot every attachment in the two official 2026 timetable posts."""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/offerings/2026'
PAGES = [('setagaya', 'https://www.asc.tcu.ac.jp/7567/'), ('yokohama', 'https://www.asc.tcu.ac.jp/7580/')]


def collect():
    OUT.mkdir(parents=True, exist_ok=True)
    references, pages = {}, []
    for campus, url in PAGES:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        (OUT / f'{campus}.html').write_bytes(response.content)
        soup = BeautifulSoup(response.content, 'html.parser')
        post = soup.select_one('div.post')
        if post is None:
            raise ValueError('Official post body not found')
        pages.append(dict(campus=campus, url=url, sha256=hashlib.sha256(response.content).hexdigest(), text=post.get_text('\n', strip=True)))
        for anchor in post.select('a[href]'):
            target = urljoin(url, anchor['href']).replace('http://www.asc.tcu.ac.jp', 'https://www.asc.tcu.ac.jp')
            if urlparse(target).hostname != 'www.asc.tcu.ac.jp' or '/wp-content/uploads/' not in target:
                continue
            label = anchor.get_text(' ', strip=True)
            references.setdefault(target, []).append(dict(campus=campus, pageUrl=url, label=label))

    def download(item):
        url, refs = item
        filename = Path(urlparse(url).path).name
        path = OUT / filename
        if not path.exists():
            response = requests.get(url, timeout=90)
            response.raise_for_status()
            path.write_bytes(response.content)
        content = path.read_bytes()
        if path.suffix.lower() == '.pdf' and not content.startswith(b'%PDF-'):
            raise ValueError(f'Not a PDF: {url}')
        return dict(id='offering-2026-' + hashlib.sha256(url.encode()).hexdigest()[:20], url=url, localPath='/offerings/2026/' + filename, sha256=hashlib.sha256(content).hexdigest(), bytes=len(content), references=refs)

    with ThreadPoolExecutor(max_workers=3) as pool:
        documents = list(pool.map(download, references.items()))
    manifest = dict(year=2026, retrievedAt=datetime.now(timezone.utc).isoformat(), pages=pages, documents=documents)
    (OUT / 'catalog.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(documents=len(documents), bytes=sum(d['bytes'] for d in documents)), ensure_ascii=False))


if __name__ == '__main__':
    collect()
