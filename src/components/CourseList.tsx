import { useState, useMemo } from 'react';
import type { AcademicCourse } from '../utils/academicProgress';

interface CourseListProps {
  courses: AcademicCourse[];
  onSelectCourse: (course: AcademicCourse) => void;
}

export default function CourseList({ courses, onSelectCourse }: CourseListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('全て');
  const [filterType, setFilterType] = useState<string>('全て');

  // カテゴリと科目区分のユニークなリストを取得
  const categories = useMemo(() => {
    const cats = new Set(courses.map(c => c.category));
    return ['全て', ...Array.from(cats).sort()];
  }, [courses]);

  const courseTypes = useMemo(() => {
    return ['全て', '必修', '選択必修', '選択'];
  }, []);

  // フィルタされた科目リスト
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSearch = searchQuery === '' || 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === '全て' || course.category === filterCategory;
      
      const matchesType = filterType === '全て' || 
        (filterType === '必修' && course.courseType === 'required') ||
        (filterType === '選択必修' && course.courseType === 'elective-required') ||
        (filterType === '選択' && course.courseType === 'elective');

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [courses, searchQuery, filterCategory, filterType]);

  const getCourseTypeLabel = (type: string) => {
    switch (type) {
      case 'required': return '必修';
      case 'elective-required': return '選択必修';
      case 'elective': return '選択';
      default: return type;
    }
  };

  const getCourseTypeColor = (type: string) => {
    switch (type) {
      case 'required': return '#e74c3c';
      case 'elective-required': return '#f39c12';
      case 'elective': return '#3498db';
      default: return '#95a5a6';
    }
  };

  if (courses.length === 0) return null;

  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="btn-ghost"
      >
        📚 科目一覧 ({courses.length}件)
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div 
            className="modal-box" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', maxHeight: '80vh' }}
          >
            <div className="modal-header">
              <h2>📚 読み込み済み科目一覧</h2>
              <button 
                className="modal-close" 
                onClick={() => setIsOpen(false)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: 'calc(80vh - 150px)', overflow: 'auto' }}>
              {/* 検索・フィルタ */}
              <div style={{ 
                position: 'sticky', 
                top: 0, 
                backgroundColor: 'white', 
                zIndex: 10,
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--stroke)',
                marginBottom: '1rem'
              }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="科目名やIDで検索..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--stroke)',
                    borderRadius: '4px',
                    marginBottom: '0.75rem'
                  }}
                />
                
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      カテゴリ
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--stroke)',
                        borderRadius: '4px'
                      }}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      科目区分
                    </label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--stroke)',
                        borderRadius: '4px'
                      }}
                    >
                      {courseTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {filteredCourses.length}件の科目が見つかりました
                </div>
              </div>

              {/* 科目リスト */}
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {filteredCourses.map(course => (
                  <div
                    key={course.id}
                    style={{
                      border: '1px solid var(--stroke)',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: 'var(--bg)'
                    }}
                    onClick={() => {
                      onSelectCourse(course);
                      setIsOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-alt)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg)';
                      e.currentTarget.style.borderColor = 'var(--stroke)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '0.95rem', 
                          fontWeight: 500,
                          marginBottom: '0.25rem'
                        }}>
                          {course.title}
                        </div>
                        <div style={{ 
                          fontSize: '0.8rem', 
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: '0.75rem',
                          flexWrap: 'wrap'
                        }}>
                          <span>ID: {course.id}</span>
                          <span>•</span>
                          <span>{course.category}</span>
                          {course.group && (
                            <>
                              <span>•</span>
                              <span>{course.group}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        flexShrink: 0
                      }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: getCourseTypeColor(course.courseType),
                          color: 'white'
                        }}>
                          {getCourseTypeLabel(course.courseType)}
                        </span>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: 'var(--bg-alt)',
                          color: 'var(--text)'
                        }}>
                          {course.credits}単位
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredCourses.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  検索条件に一致する科目が見つかりませんでした
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
