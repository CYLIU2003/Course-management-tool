"""Recover clipped leading characters from the same PDF row, never by guessing."""
import re
import unicodedata


def compact(value):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', value))


def recover_course_titles(page, courses):
    words = page.get_text('words')
    changes = 0
    for course in courses:
        code = course['sourceCode']
        title = course['title']
        base = compact(title.split('※')[0])
        if not code or len(base) < 3:
            continue
        anchors = [word for word in words if compact(word[4]) == compact(code)]
        if len(anchors) != 1:
            continue
        anchor = anchors[0]
        candidates = {compact(word[4]): word for word in words
                      if abs(word[1] - anchor[1]) < 2 and word[0] < anchor[0]
                      and compact(word[4]).endswith(base) and 0 < len(compact(word[4])) - len(base) <= 3}
        if len(candidates) != 1:
            continue
        full_title, word = next(iter(candidates.items()))
        prefix = full_title[:-len(base)]
        if not re.fullmatch(r'[一-龯ぁ-んァ-ヶー]+', prefix):
            continue
        course['originalExtractedTitle'] = title
        course['title'] = prefix + title
        course['titleEvidence'] = dict(word=word[4], bbox=list(word[:4]), sourceCode=code)
        changes += 1
    return changes
