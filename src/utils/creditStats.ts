import type { AcademicAllYearsData } from './academicProgress';
import { calculateGpaSummary } from './gpa';

export type CreditCompletionRate = {
  registeredCredits: number;
  earnedCredits: number;
  failedCredits: number;
  completionRate: number;
};

export function calculateCreditCompletionRate(allYearsData: AcademicAllYearsData, currentGpaSnapshot: { currentGpa: number; currentEarnedPoints: number; currentGradedCredits: number; predictedGpa: number; addedCredits: number; }): CreditCompletionRate {
  const summary = calculateGpaSummary(allYearsData, {
    requiredCredits: 0,
    earnedCredits: 0,
    gradedCredits: currentGpaSnapshot.currentGradedCredits,
    completionRate: 0,
    gpa: currentGpaSnapshot,
    progress: [],
    warnings: [],
  });

  return {
    registeredCredits: summary.registeredCredits,
    earnedCredits: summary.earnedCredits,
    failedCredits: summary.failedCredits,
    completionRate: summary.registeredCredits === 0 ? 0 : (summary.earnedCredits / summary.registeredCredits) * 100,
  };
}