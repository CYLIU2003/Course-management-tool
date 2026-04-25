import {
  calculateCurrentGpa as calculateCurrentGpaInternal,
  predictGpa as predictGpaInternal,
} from "../../utils/academicProgress";
import type { AcademicAllYearsData, AcademicGpaPredictionInput } from "../types";

export function calculateCurrentGpa(allYearsData: AcademicAllYearsData) {
  return calculateCurrentGpaInternal(allYearsData);
}

export function predictGpa(input: AcademicGpaPredictionInput) {
  return predictGpaInternal(input);
}
