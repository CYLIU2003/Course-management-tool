"""Preserve official teaching-office FAQ alongside cohort-specific TAP evidence."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import requests
import unicodedata
from bs4 import BeautifulSoup

DEST = Path(__file__).resolve().parents[2] / 'public/handbooks'


def collect():
    url = 'https://www.asc.tcu.ac.jp/2445/'
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    html = response.content
    (DEST / 'tap-faq.html').write_bytes(html)
    soup = BeautifulSoup(html, 'html.parser')
    matches = []
    for question in soup.select('summary'):
        if 'TAP' in question.get_text():
            container = question.parent
            answer = ' '.join(node.get_text(' ', strip=True) for node in container.find_all('p'))
            if not answer:
                raise ValueError('TAP FAQ answer missing')
            matches.append(dict(question=unicodedata.normalize('NFKC', question.get_text(' ', strip=True)), answer=unicodedata.normalize('NFKC', answer)))
    if not matches:
        raise ValueError('TAP FAQ no longer found; review website structure')
    data = dict(id='tap-faq', url=url, retrievedAt=datetime.now(timezone.utc).isoformat(), sha256=hashlib.sha256(html).hexdigest(), localPath='/handbooks/tap-faq.html', entries=matches,
                applicability='現在のFAQ。入学年度の要覧を優先し、年度別要件の代用はしません。')
    (DEST / 'tap-faq.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(data, ensure_ascii=True))


if __name__ == '__main__':
    collect()
