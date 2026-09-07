"""Apply source-bound, individually reviewed resolutions of duplicate title rows."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVIEWS = Path(__file__).with_name('title_reviews.json')


def apply_title_reviews(data):
    reviews = json.loads(REVIEWS.read_text(encoding='utf8'))['reviews']
    rows = {course['id']: course for course in data['courses']}
    changed = 0
    for review in reviews:
        if review['sourceId'] != data['id']:
            continue
        if review['sourceSha256'] != data['sha256']:
            raise ValueError('Title review requires the unchanged original PDF')
        accepted = rows[review['acceptedId']]
        rejected = rows[review['rejectedId']]
        repaired_duplicate = (rejected['verification'].get('titleText') == review['acceptedTitle']
                              and rejected['verification'].get('titleBbox') == review['titleBbox']
                              and rejected['credits'] == accepted['credits'])
        if (accepted['verification'].get('status') != 'pdf_position_checked'
                or accepted['verification']['titleText'] != review['acceptedTitle']
                or accepted['verification']['titleBbox'] != review['titleBbox']
                or (rejected['verification']['titleText'] != review['rejectedTitle'] and not repaired_duplicate)
                or accepted['page'] != review['page'] or rejected['page'] != review['page']):
            raise ValueError(f'Title review no longer matches original row evidence: {review["rejectedId"]}; accepted={accepted["verification"]}; rejected={rejected["verification"]}')
        rejected['verification'] = dict(rejected['verification'], status='quarantined',
            reason='superseded_by_original_title_cell', replacementId=accepted['id'],
            titleReview=review)
        changed += 1
    return changed


def main():
    changed = 0
    for path in (ROOT / 'public/handbooks/extracted').glob('*.json'):
        data = json.loads(path.read_text(encoding='utf8'))
        count = apply_title_reviews(data)
        if count:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
            changed += count
    print(f'Applied {changed} original-title resolutions')


if __name__ == '__main__':
    main()
