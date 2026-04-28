import type { AcademicYear } from './academicProgress';

export type RequirementStatus = 'completed' | 'completed_with_planned' | 'shortage' | 'not_started';

export interface RequirementCategorySummary {
  categoryId: string;
  categoryName: string;
  description?: string;
  requiredCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  remainingCredits: number;
  status: RequirementStatus;
  totalEligibleCourses?: number;
  countedCourses?: number;
  plannedCourses?: number;
  passedCourses?: number;
}

export type CourseTakenStatus = 'passed' | 'planned' | 'not_taken';

export type CategoryMatchState =
  | 'counted_in_this_category'
  | 'eligible_for_this_category'
  | 'counted_in_other_category'
  | 'not_eligible';

export interface CategoryCourse {
  courseId: string;
  courseCode?: string;
  courseName: string;
  credits: number;
  yearLevel?: number;
  semester?: string;
  dayPeriod?: string;
  instructor?: string;
  takenStatus: CourseTakenStatus;
  matchState: CategoryMatchState;
  countedCategoryId?: string;
  countedCategoryName?: string;
  eligibleCategoryIds?: string[];
}

export interface RequirementCategoryDetail extends RequirementCategorySummary {
  courses: CategoryCourse[];
}

export type CategoryCourseTab = 'candidate' | 'achievements' | 'all';

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  completed: '達成済',
  completed_with_planned: '予定込み達成',
  shortage: '不足あり',
  not_started: '未着手',
};

export const COURSE_TAKEN_STATUS_LABELS: Record<CourseTakenStatus, string> = {
  passed: '取得済',
  planned: '履修予定',
  not_taken: '未取得',
};

export const CATEGORY_MATCH_STATE_LABELS: Record<CategoryMatchState, string> = {
  counted_in_this_category: 'この区分に反映済',
  eligible_for_this_category: 'この区分の候補',
  counted_in_other_category: '他区分に反映済',
  not_eligible: '対象外',
};

export const CATEGORY_COURSE_TAB_LABELS: Record<CategoryCourseTab, string> = {
  candidate: '履修候補',
  achievements: 'あなたの実績',
  all: 'すべて',
};

export const CATEGORY_COURSE_TAB_ORDER: CategoryCourseTab[] = ['candidate', 'achievements', 'all'];

export interface BadgeTheme {
  background: string;
  border: string;
  color: string;
}

export const REQUIREMENT_STATUS_THEME: Record<RequirementStatus, BadgeTheme> = {
  completed: {
    background: 'color-mix(in oklab, var(--primary-soft) 82%, var(--surface) 18%)',
    border: 'color-mix(in oklab, var(--primary) 28%, var(--border-soft) 72%)',
    color: 'var(--primary-strong)',
  },
  completed_with_planned: {
    background: 'color-mix(in oklab, var(--info-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--info) 28%, var(--border-soft) 72%)',
    color: 'var(--info)',
  },
  shortage: {
    background: 'color-mix(in oklab, var(--warning-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--warning) 28%, var(--border-soft) 72%)',
    color: 'var(--warning)',
  },
  not_started: {
    background: 'color-mix(in oklab, var(--border-soft) 62%, var(--surface) 38%)',
    border: 'var(--border)',
    color: 'var(--text-sub)',
  },
};

export const COURSE_TAKEN_STATUS_THEME: Record<CourseTakenStatus, BadgeTheme> = {
  passed: {
    background: 'color-mix(in oklab, var(--primary-soft) 82%, var(--surface) 18%)',
    border: 'color-mix(in oklab, var(--primary) 28%, var(--border-soft) 72%)',
    color: 'var(--primary-strong)',
  },
  planned: {
    background: 'color-mix(in oklab, var(--info-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--info) 28%, var(--border-soft) 72%)',
    color: 'var(--info)',
  },
  not_taken: {
    background: 'color-mix(in oklab, var(--border-soft) 62%, var(--surface) 38%)',
    border: 'var(--border)',
    color: 'var(--text-sub)',
  },
};

export const CATEGORY_MATCH_STATE_THEME: Record<CategoryMatchState, BadgeTheme> = {
  counted_in_this_category: {
    background: 'color-mix(in oklab, var(--primary-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--primary) 28%, var(--border-soft) 72%)',
    color: 'var(--primary-strong)',
  },
  eligible_for_this_category: {
    background: 'color-mix(in oklab, var(--info-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--info) 28%, var(--border-soft) 72%)',
    color: 'var(--info)',
  },
  counted_in_other_category: {
    background: 'color-mix(in oklab, var(--warning-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--warning) 28%, var(--border-soft) 72%)',
    color: 'var(--warning)',
  },
  not_eligible: {
    background: 'color-mix(in oklab, var(--border-soft) 62%, var(--surface) 38%)',
    border: 'var(--border)',
    color: 'var(--text-sub)',
  },
};

const SEMESTER_ORDER: Record<string, number> = {
  前期: 0,
  春学期: 0,
  通年: 1,
  後期: 2,
  夏学期: 3,
  秋学期: 4,
};

export function calculateRequirementStatus(requiredCredits: number, earnedCredits: number, plannedCredits: number): RequirementStatus {
  if (earnedCredits >= requiredCredits) {
    return 'completed';
  }

  if (earnedCredits + plannedCredits >= requiredCredits) {
    return 'completed_with_planned';
  }

  if (earnedCredits === 0 && plannedCredits === 0) {
    return 'not_started';
  }

  return 'shortage';
}

export function calculateRequirementProgressPercent(requiredCredits: number, earnedCredits: number, plannedCredits: number) {
  if (requiredCredits === 0) {
    return 100;
  }

  return Math.min(100, Math.round(((earnedCredits + plannedCredits) / requiredCredits) * 100));
}

type RequirementPaceTone = 'on_track' | 'steady' | 'warning' | 'fresh';

function getAcademicYearIndex(currentYear?: AcademicYear) {
  switch (currentYear) {
    case '1年次':
      return 1;
    case '2年次':
      return 2;
    case '3年次':
      return 3;
    case '4年次':
      return 4;
    case 'M1':
      return 5;
    case 'M2':
      return 6;
    default:
      return null;
  }
}

function getRequirementProgressTone(currentYear: AcademicYear | undefined, progressPercent: number): RequirementPaceTone {
  const yearIndex = getAcademicYearIndex(currentYear);

  if (!yearIndex) {
    if (progressPercent >= 75) {
      return 'on_track';
    }

    if (progressPercent >= 45) {
      return 'steady';
    }

    if (progressPercent >= 15) {
      return 'warning';
    }

    return 'fresh';
  }

  if (yearIndex === 1) {
    if (progressPercent >= 35) {
      return 'on_track';
    }

    if (progressPercent >= 10) {
      return 'steady';
    }

    return 'fresh';
  }

  if (yearIndex === 2) {
    if (progressPercent >= 55) {
      return 'on_track';
    }

    if (progressPercent >= 25) {
      return 'steady';
    }

    return 'fresh';
  }

  if (yearIndex === 3) {
    if (progressPercent >= 75) {
      return 'on_track';
    }

    if (progressPercent >= 45) {
      return 'steady';
    }

    return 'warning';
  }

  if (yearIndex === 4) {
    if (progressPercent >= 90) {
      return 'on_track';
    }

    if (progressPercent >= 65) {
      return 'steady';
    }

    return 'warning';
  }

  if (progressPercent >= 95) {
    return 'on_track';
  }

  if (progressPercent >= 80) {
    return 'steady';
  }

  return 'warning';
}

export function resolveRequirementProgressTheme(status: RequirementStatus, progressPercent: number, currentYear?: AcademicYear): BadgeTheme {
  if (status === 'completed' || status === 'completed_with_planned') {
    return REQUIREMENT_STATUS_THEME[status];
  }

  const tone = getRequirementProgressTone(currentYear, progressPercent);

  switch (tone) {
    case 'on_track':
      return REQUIREMENT_STATUS_THEME.completed;
    case 'steady':
      return REQUIREMENT_STATUS_THEME.completed_with_planned;
    case 'warning':
      return REQUIREMENT_STATUS_THEME.shortage;
    case 'fresh':
    default:
      return REQUIREMENT_STATUS_THEME.not_started;
  }
}

export function filterCoursesByTab(courses: CategoryCourse[], tab: CategoryCourseTab) {
  switch (tab) {
    case 'candidate':
      return courses.filter((course) => course.matchState === 'eligible_for_this_category' && course.takenStatus === 'not_taken');

    case 'achievements':
      return courses.filter((course) => course.takenStatus === 'passed' || course.takenStatus === 'planned');

    case 'all':
    default:
      return courses;
  }
}

function getCourseDisplayGroup(course: CategoryCourse) {
  if (course.matchState === 'counted_in_this_category') {
    return 0;
  }

  if (course.takenStatus === 'planned') {
    return 1;
  }

  if (course.matchState === 'eligible_for_this_category') {
    return 2;
  }

  if (course.matchState === 'counted_in_other_category') {
    return 3;
  }

  return 4;
}

export function sortCategoryCourses(courses: CategoryCourse[]) {
  return [...courses].sort((left, right) => {
    const groupDifference = getCourseDisplayGroup(left) - getCourseDisplayGroup(right);
    if (groupDifference !== 0) {
      return groupDifference;
    }

    const leftYear = left.yearLevel ?? Number.POSITIVE_INFINITY;
    const rightYear = right.yearLevel ?? Number.POSITIVE_INFINITY;
    if (leftYear !== rightYear) {
      return leftYear - rightYear;
    }

    const leftSemester = SEMESTER_ORDER[left.semester ?? ''] ?? 99;
    const rightSemester = SEMESTER_ORDER[right.semester ?? ''] ?? 99;
    if (leftSemester !== rightSemester) {
      return leftSemester - rightSemester;
    }

    const nameDifference = left.courseName.localeCompare(right.courseName, 'ja');
    if (nameDifference !== 0) {
      return nameDifference;
    }

    return (left.courseCode ?? '').localeCompare(right.courseCode ?? '', 'ja');
  });
}
