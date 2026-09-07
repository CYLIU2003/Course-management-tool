export interface StudyOptions {
  isGeneral: boolean;
  takesTeacher: boolean;
  takesHirameki: boolean;
  takesTap: boolean;
  degreeVariant?: string | null;
}

export const DEFAULT_OPTIONS: StudyOptions = {
  isGeneral: true, takesTeacher: false, takesHirameki: false, takesTap: false,
};
