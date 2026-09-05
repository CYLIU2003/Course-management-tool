"""Curated cohort summaries, checked against the six downloaded leaflets.

Detailed elective symbol matrices remain source evidence, not automatic rules.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'public/handbooks'
OTHER_FACULTIES = ['kenchiku_toshi', 'joho', 'kankyo', 'media_joho', 'toshi_seikatsu', 'ningen']
RIKOU_DEPARTMENTS = ['kikai', 'kikai_system', 'denki', 'iyo', 'ouyou_kagaku', 'genshiryoku', 'shizen_shizen', 'shizen_suuri']


def build_programs():
    sources = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))['documents']
    programs = []
    for source in sources:
        if source['kind'] != 'hirameki':
            continue
        year = source['year']
        is_basic = year == 2026 or '他6学部' in source['label']
        source_id = f"hirameki-{year}-{Path(source['localPath']).stem}"
        program = dict(id=source_id, entranceYears=source['entranceYears'],
                       facultyIds=(['rikou'] + OTHER_FACULTIES if year == 2026 else OTHER_FACULTIES) if is_basic else ['rikou'],
                       title='ひらめき 基礎プログラム' if is_basic else 'ひらめき プログラム' + ('（実践）' if year == 2025 else ''),
                       sourceId=source_id, sourcePage=4 if year == 2022 else 2,
                       totalCredits=12 if is_basic else 124, groups=[], courses=[],
                       assessment='course_list' if is_basic else 'department_conditions',
                       notes=['パンフレットの適用入学年度に基づく情報です。履修登録方法・先修条件・卒業要件への算入は、当該年度の学修要覧と正誤表を確認してください。'])
        if year == 2026:
            program['courses'] = [dict(title=title, credits=credits) for title, credits in [
                ('ことづくり', 1), ('デザインリサーチ', 2), ('サステナビリティ', 2), ('デザインシンキング', 2),
                ('アイデアソン演習', 1), ('ハッカソン演習', 1), ('ビジネスコンテスト演習', 1), ('フィールドリサーチ', 2)]]
        elif is_basic:
            program['courses'] = [dict(title=f'{title}({number})', credits=1)
                                  for title, count in [('ことづくり', 5), ('ひらめきづくり', 5), ('Next PBL', 2)]
                                  for number in range(1, count + 1)]
        if is_basic:
            program['groups'] = [dict(name='基礎プログラム', credits=12)]
            assert sum(course['credits'] for course in program['courses']) == 12
            program['notes'].append('成績との照合は科目名と単位数の一致を確認します。表示単位が揃っていても大学による修了認定を意味しません。')
        else:
            program['departmentIds'] = RIKOU_DEPARTMENTS[:3] if year == 2022 else RIKOU_DEPARTMENTS[:6] if year == 2023 else RIKOU_DEPARTMENTS
            program['groups'] = [dict(name=name, credits=credits) for name, credits in (
                [('ひらめきづくり', 14), ('ことづくり', 14), ('AI・ビッグデータ・数理データサイエンス', 20), ('ものづくり', 48), ('ひとづくり', 28)] if year == 2022 else
                [('ひらめきづくり', 11), ('ことづくり', 11), ('AI・ビッグデータ・数理データサイエンス', 20), ('ものづくり', 48), ('くらしづくり', 8), ('ひとづくり', 26)])]
            if year >= 2023:
                program['groups'][3]['note'] = '48単位の内数として分野融合科目8単位を含む。'
                program['groups'][4]['note'] = 'パンフレットでは自由選択扱い。算入条件は学修要覧で確認。'
            program['notes'].extend(['各群の単位数に加え、学科・コース別の必修と各記号の選択必修条件を満たす必要があります。',
                                     '124単位の内訳はパンフレットのプログラム構成です。学科の卒業要件と別に124単位を加算するものではありません。',
                                     '学則上の科目名とプログラム内の呼称が異なる科目があります。詳細表の「学則上の科目名」を確認してください。'])
            assert sum(group['credits'] for group in program['groups']) == 124
        programs.append(program)
    (DEST / 'hirameki-programs.json').write_text(json.dumps(dict(schemaVersion=1, programs=programs), ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    build_programs()
