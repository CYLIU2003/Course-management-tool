export type AssignmentFrequency = 'none' | 'low' | 'medium' | 'high';

export type ExamType = 'none' | 'written' | 'report' | 'presentation' | 'practical' | 'other';

export type LearningLoadMemo = {
  courseId: string;
  courseName: string;
  weeklyPreparationHours?: number;
  weeklyReviewHours?: number;
  assignmentFrequency?: AssignmentFrequency;
  reportRequired?: boolean;
  examType?: ExamType;
  attendanceCheck?: boolean;
  note?: string;
  updatedAt: string;
};

const STORAGE_KEY = 'learning_load_memos_v1';

export function loadLearningLoadMemos(): LearningLoadMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is LearningLoadMemo => Boolean(item && typeof item === 'object' && 'courseId' in item && 'courseName' in item && 'updatedAt' in item));
  } catch {
    return [];
  }
}

export function saveLearningLoadMemos(memos: LearningLoadMemo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}