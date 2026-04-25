import type { AcademicGpaSnapshot } from './academicProgress';

export type TargetGpaPlan = {
  currentGpa: number;
  targetGpa: number;
  currentGpaCredits: number;
  futureCredits: number;
  requiredAverageGradePoint: number;
  isAchievable: boolean;
  message: string;
};

function formatRequiredMessage(requiredAverageGradePoint: number, isAchievable: boolean) {
  if (!Number.isFinite(requiredAverageGradePoint) || requiredAverageGradePoint <= 0) {
    return '今後の履修単位数を入力してください。';
  }

  if (!isAchievable) {
    return '目標達成には4.0を超える平均GPが必要です。達成困難です。';
  }

  if (requiredAverageGradePoint >= 3.0) {
    return '今後の科目で「優」以上を中心に取得する必要があります。';
  }

  if (requiredAverageGradePoint >= 2.0) {
    return '今後の科目で「良」〜「優」中心で到達可能です。';
  }

  return '今後の科目で「可」以上を安定して取得できれば到達可能です。';
}

export function calculateTargetGpaPlan(snapshot: AcademicGpaSnapshot, targetGpa: number, futureCredits: number): TargetGpaPlan {
  const currentGpaCredits = snapshot.currentGradedCredits;

  if (futureCredits <= 0) {
    return {
      currentGpa: snapshot.currentGpa,
      targetGpa,
      currentGpaCredits,
      futureCredits,
      requiredAverageGradePoint: 0,
      isAchievable: false,
      message: '今後の履修単位数を入力してください。',
    };
  }

  const requiredAverageGradePoint = (
    (targetGpa * (currentGpaCredits + futureCredits)) - (snapshot.currentGpa * currentGpaCredits)
  ) / futureCredits;

  const isAchievable = requiredAverageGradePoint <= 4.0;

  return {
    currentGpa: snapshot.currentGpa,
    targetGpa,
    currentGpaCredits,
    futureCredits,
    requiredAverageGradePoint,
    isAchievable,
    message: formatRequiredMessage(requiredAverageGradePoint, isAchievable),
  };
}