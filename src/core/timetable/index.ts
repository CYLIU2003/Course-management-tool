import type { AcademicTimetable } from "../types";

export interface TimetableConflict {
  quarter: string;
  day: string;
  periodId: string;
  courses: Array<{ title: string; room?: string }>;
}

export function checkTimetableConflicts(timetable: AcademicTimetable): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  for (const [quarter, quarterData] of Object.entries(timetable)) {
    for (const [day, dayData] of Object.entries(quarterData ?? {})) {
      for (const [periodId, cell] of Object.entries(dayData ?? {})) {
        if (!cell || !cell.title) {
          continue;
        }

        const aliases = [cell.title, cell.className].filter(Boolean) as string[];
        const uniqueTitles = [...new Set(aliases.map((value) => value.trim()).filter(Boolean))];

        if (uniqueTitles.length > 1) {
          conflicts.push({
            quarter,
            day,
            periodId,
            courses: uniqueTitles.map((title) => ({
              title,
              room: cell.room,
            })),
          });
        }
      }
    }
  }

  return conflicts;
}
