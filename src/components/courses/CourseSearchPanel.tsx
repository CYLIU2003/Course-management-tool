import { useMemo, useState } from 'react';
import CourseTagBadge from './CourseTagBadge';
import CourseTypeBadge from './CourseTypeBadge';
import type { AcademicCourse, CourseType, CourseOffering } from '../../utils/academicProgress';

type CourseSearchPanelProps = {
  courses: AcademicCourse[];
};

type CourseFilter = CourseType | 'all';

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function getDisplayTags(course: AcademicCourse) {
  const tags = [...(course.tags ?? [])];
  if (course.requirementSubtype === 'triangle1') tags.push('△1');
  if (course.requirementSubtype === 'triangle2') tags.push('△2');
  return tags;
}

function formatOffering(offering: CourseOffering) {
  const parts = [
    offering.term,
    offering.gradeYear,
    offering.day && offering.period ? `${offering.day}${offering.period}限` : '',
    offering.className ? `クラス ${offering.className}` : '',
    offering.teacher ? `担当 ${offering.teacher}` : '',
    offering.room ? `教室 ${offering.room}` : '',
    offering.lectureCode ? `講義コード ${offering.lectureCode}` : '',
  ]
    .filter(Boolean);

  return parts.join(' / ');
}

function getOfferingSearchText(offering: CourseOffering) {
  return [
    offering.day,
    offering.period,
    offering.term,
    offering.gradeYear,
    offering.className,
    offering.teacher,
    offering.lectureCode,
    offering.room,
    offering.target,
    offering.remarks,
  ].filter(Boolean).join(' ');
}

export default function CourseSearchPanel({ courses }: CourseSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [group, setGroup] = useState('all');
  const [courseType, setCourseType] = useState<CourseFilter>('all');
  const [tag, setTag] = useState('all');

  const categories = useMemo(() => [...new Set(courses.map((course) => course.category).filter(Boolean))].sort(), [courses]);
  const groups = useMemo(() => [...new Set(courses.map((course) => course.group).filter(Boolean))].sort(), [courses]);
  const tags = useMemo(() => {
    const collected = courses.flatMap((course) => getDisplayTags(course));
    return [...new Set(collected)].sort();
  }, [courses]);

  const filtered = useMemo(() => {
    const keyword = normalize(query);
    return courses.filter((course) => {
      const displayTags = getDisplayTags(course);
      const matchesKeyword = !keyword || normalize([
        course.id,
        course.title,
        course.category,
        course.group,
        course.rawRequired ?? '',
        course.courseType,
        ...displayTags,
        ...(course.offerings ?? []).flatMap((offering) => [getOfferingSearchText(offering)]),
      ].join(' ')).includes(keyword);
      const matchesCategory = category === 'all' || course.category === category;
      const matchesGroup = group === 'all' || course.group === group;
      const matchesCourseType = courseType === 'all' || course.courseType === courseType;
      const matchesTag = tag === 'all' || displayTags.includes(tag);
      return matchesKeyword && matchesCategory && matchesGroup && matchesCourseType && matchesTag;
    });
  }, [courses, query, category, group, courseType, tag]);

  const visible = filtered.slice(0, query.trim() ? 50 : 30);

  return (
    <section className="tt-card course-search">
      <div className="section-title">
        <h2>科目一覧・検索</h2>
        <span className="small">CSV 読み込み済み {courses.length} 件</span>
      </div>

      <div className="course-search__filters">
        <label className="course-search__field">
          <span>検索</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="科目名、ID、区分、タグなど" />
        </label>
        <label className="course-search__field">
          <span>カテゴリ</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">すべて</option>
            {categories.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="course-search__field">
          <span>科目群</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">すべて</option>
            {groups.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="course-search__field">
          <span>区分</span>
          <select value={courseType} onChange={(e) => setCourseType(e.target.value as CourseFilter)}>
            <option value="all">すべて</option>
            <option value="required">必修</option>
            <option value="elective-required">選択必修</option>
            <option value="elective">選択</option>
          </select>
        </label>
        <label className="course-search__field">
          <span>タグ</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">すべて</option>
            {tags.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="course-search__meta">
        <span>表示 {visible.length} 件</span>
        <span>絞り込み結果 {filtered.length} 件</span>
      </div>

      {visible.length === 0 ? (
        <div className="course-search__empty">一致する科目がありません。</div>
      ) : (
        <div className="course-search__list">
          {visible.map((course) => {
            const displayTags = getDisplayTags(course);
            return (
              <article key={course.id} className="course-search__item">
                <div className="course-search__item-head">
                  <div>
                    <h3>{course.title}</h3>
                    <p>{course.id}</p>
                  </div>
                  <CourseTypeBadge courseType={course.courseType} />
                </div>
                <div className="course-search__chips">
                  {displayTags.map((value) => <CourseTagBadge key={value} label={value} />)}
                </div>
                {(course.offerings?.length ?? 0) > 0 && (
                  <div className="course-search__offerings">
                    <strong>開講情報</strong>
                    {course.offerings?.slice(0, 3).map((offering, index) => (
                      <div key={`${course.id}-${index}`} className="course-search__offering">
                        <strong>{formatOffering(offering) || '開講情報あり'}</strong>
                        <span>
                          {offering.lectureCode ? `講義コード ${offering.lectureCode}` : '講義コード未設定'}
                          {offering.gradeYear ? ` / ${offering.gradeYear}年` : ''}
                          {offering.className ? ` / ${offering.className}` : ''}
                          {offering.target ? ` / ${offering.target}` : ''}
                          {offering.remarks ? ` / ${offering.remarks}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <dl className="course-search__details">
                  <div><dt>単位数</dt><dd>{course.credits}</dd></div>
                  <div><dt>カテゴリ</dt><dd>{course.category || '未設定'}</dd></div>
                  <div><dt>科目群</dt><dd>{course.group || '未設定'}</dd></div>
                  <div><dt>raw_required</dt><dd>{course.rawRequired || 'なし'}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
