function buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const dept = findDepartment(departmentId);
  const facultyId = dept?.facultyId ?? 'rikou';
  const basePath = \/department/\\;
  const legacyRikouPath = \/department/rikou\;

  if (entranceYear) {
    return {
      requirements: \\/\/\_credit_requirements.csv\,
      timetable: \\/\/\_timetable_by_category.csv\,
      schedule: \\/\/\_\_spring_schedule.csv\,
      sharedSchedule: \\/\/\_\_spring_schedule.csv\,
      applicableCourses: \\/\/\_applicable_courses.csv\,
      fallbackRequirements: \\/\_credit_requirements.csv\,
      fallbackTimetable: \\/\_timetable_by_category.csv\,
      fallbackSchedule: \\/\_\_spring_schedule.csv\,
    } as any;
  }

  return {
    requirements: \\/\_credit_requirements.csv\,
    timetable: \\/\_timetable_by_category.csv\,
    schedule: \\/\_2026_spring_schedule.csv\,
    sharedSchedule: \\/\_2026_spring_schedule.csv\,
    applicableCourses: \\/2026/\_applicable_courses.csv\,
    fallbackRequirements: \\/\_credit_requirements.csv\,
    fallbackTimetable: \\/\_timetable_by_category.csv\,
    fallbackSchedule: \\/\_2026_spring_schedule.csv\,
  } as any;
}
