import type { Grade } from './academicProgress';

export type ScannedGradeCandidate = {
  id: string;
  courseName: string;
  credits?: number;
  grade?: Grade;
  confidence?: number;
  rawText?: string;
  needsReview: boolean;
};

const GRADE_VALUES: Grade[] = ['秀', '優', '良', '可', '不可', '未履修'];

function parseGrade(value: string): Grade | undefined {
  const normalized = value.trim();
  return GRADE_VALUES.find((grade) => grade === normalized);
}

export function parseScannedGradeText(input: string): ScannedGradeCandidate[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const parts = line.split(/[\t,]/).map((part) => part.trim()).filter(Boolean);
    const [courseName = '', creditsText = '', gradeText = '', confidenceText = ''] = parts;
    const credits = Number.parseFloat(creditsText);
    const confidence = Number.parseFloat(confidenceText);

    return {
      id: `scan-${index + 1}`,
      courseName,
      credits: Number.isFinite(credits) ? credits : undefined,
      grade: parseGrade(gradeText),
      confidence: Number.isFinite(confidence) ? confidence : undefined,
      rawText: line,
      needsReview: true,
    };
  });
}