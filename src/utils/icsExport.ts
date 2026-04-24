import type { AcademicQuarter, AcademicTimetable } from './academicProgress';

export type CalendarExportRange = '1Q' | '2Q' | '3Q' | '4Q' | 'spring' | 'fall' | 'full-year';
export type CalendarAlarmMinutes = 0 | 10 | 30;

export interface AcademicCalendarQuarterConfig {
  start: string;
  end: string;
  excludedDates?: string[];
}

export interface AcademicCalendarConfig {
  academicYear: number;
  timezone: string;
  quarters: Record<AcademicQuarter, AcademicCalendarQuarterConfig>;
}

export interface CalendarExportOptions {
  academicYear: number;
  range: CalendarExportRange;
  alarmMinutes: CalendarAlarmMinutes;
  includeRoom: boolean;
  includeTeacher: boolean;
  includeAssignmentDeadlines: boolean;
  includeExamDates: boolean;
  academicCalendar: AcademicCalendarConfig;
  quarterRanges?: Record<AcademicQuarter, { start: string; end: string }>;
}

export interface CalendarExportSource {
  timetable: AcademicTimetable;
  academicYearLabel: string;
  days: string[];
  periods: { id: number; label: string; time: string }[];
}

type ParsedTimeRange = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

type QuarterRangeKey = AcademicQuarter;

const QUARTER_GROUPS: Record<Exclude<CalendarExportRange, '1Q' | '2Q' | '3Q' | '4Q'>, QuarterRangeKey[]> = {
  spring: ['1Q', '2Q'],
  fall: ['3Q', '4Q'],
  'full-year': ['1Q', '2Q', '3Q', '4Q'],
};

const DAY_TO_WEEKDAY_INDEX: Record<string, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6,
};

function isQuarter(value: string): value is AcademicQuarter {
  return value === '1Q' || value === '2Q' || value === '3Q' || value === '4Q';
}

function toLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatIcsDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatIcsDateUtc(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function formatFilenameDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function escapeICSText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function parseTimeRange(time: string): ParsedTimeRange | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    startHour: Number(match[1]),
    startMinute: Number(match[2]),
    endHour: Number(match[3]),
    endMinute: Number(match[4]),
  };
}

function mapDayToWeekdayIndex(day: string) {
  return DAY_TO_WEEKDAY_INDEX[day] ?? null;
}

function getFirstOccurrence(startDate: Date, weekday: number) {
  const first = new Date(startDate.getTime());
  const offset = (weekday - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + offset);
  return first;
}

function combineDateAndTime(date: Date, hour: number, minute: number) {
  const next = new Date(date.getTime());
  next.setHours(hour, minute, 0, 0);
  return next;
}

function normalizeQuarterRange(range: AcademicCalendarQuarterConfig | undefined, fallback?: { start: string; end: string }) {
  const start = range?.start?.trim() || fallback?.start || '';
  const end = range?.end?.trim() || fallback?.end || '';
  const excludedDates = (range?.excludedDates ?? []).filter((value) => Boolean(value && value.trim()));

  return {
    start,
    end,
    excludedDates,
  };
}

function resolveQuarterList(range: CalendarExportRange) {
  if (isQuarter(range)) {
    return [range];
  }

  return QUARTER_GROUPS[range];
}

function createStableUid(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${(hash >>> 0).toString(16)}@tcu-calendar.local`;
}

function buildAlarmBlock(summary: string, alarmMinutes: CalendarAlarmMinutes) {
  if (alarmMinutes === 0) {
    return [];
  }

  return [
    'BEGIN:VALARM',
    `TRIGGER:-PT${alarmMinutes}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICSText(summary)}`,
    'END:VALARM',
  ];
}

function buildTimezoneBlock(timezone: string) {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${escapeICSText(timezone)}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:JST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

function shouldGenerateOccurrence(dateKey: string, excludedDates: Set<string>) {
  return !excludedDates.has(dateKey);
}

function buildEventLines(params: {
  title: string;
  academicYear: number;
  academicYearLabel: string;
  rangeLabel: string;
  quarter: AcademicQuarter;
  day: string;
  periodLabel: string;
  startDateTime: Date;
  endDateTime: Date;
  timezone: string;
  room?: string;
  teacher?: string;
  memo?: string;
  remarks?: string;
  alarmMinutes: CalendarAlarmMinutes;
  includeRoom: boolean;
  includeTeacher: boolean;
}) {
  const summary = params.title;
  const descriptionLines = [
    `科目名: ${params.title}`,
    `学年: ${params.academicYearLabel}`,
    `年度: ${params.academicYear}`,
    `範囲: ${params.rangeLabel}`,
    `クォーター: ${params.quarter}`,
    `曜日: ${params.day}`,
    `時限: ${params.periodLabel}`,
  ];

  if (params.includeTeacher && params.teacher) {
    descriptionLines.push(`担当教員: ${params.teacher}`);
  }

  if (params.memo) {
    descriptionLines.push(`備考: ${params.memo}`);
  }

  if (params.remarks) {
    descriptionLines.push(`開講備考: ${params.remarks}`);
  }

  const lines = [
    'BEGIN:VEVENT',
    `UID:${createStableUid(`${params.academicYear}|${params.rangeLabel}|${params.quarter}|${params.day}|${params.periodLabel}|${params.title}|${formatIcsDate(params.startDateTime)}`)}`,
    `DTSTAMP:${formatIcsDateUtc(new Date())}`,
    `DTSTART;TZID=${params.timezone}:${formatIcsDate(params.startDateTime)}`,
    `DTEND;TZID=${params.timezone}:${formatIcsDate(params.endDateTime)}`,
    `SUMMARY:${escapeICSText(summary)}`,
  ];

  if (params.includeRoom && params.room) {
    lines.push(`LOCATION:${escapeICSText(params.room)}`);
  }

  lines.push(`DESCRIPTION:${escapeICSText(descriptionLines.join('\n'))}`);
  lines.push(...buildAlarmBlock(summary, params.alarmMinutes));
  lines.push('END:VEVENT');

  return lines;
}

function getResolvedQuarterConfig(
  academicCalendar: AcademicCalendarConfig,
  rangeLabel: QuarterRangeKey,
  quarterRanges?: Record<AcademicQuarter, { start: string; end: string }>,
) {
  const fallback = quarterRanges?.[rangeLabel];
  return normalizeQuarterRange(academicCalendar.quarters[rangeLabel], fallback);
}

export function buildCalendarExportFilename(academicYear: number, range: CalendarExportRange, date = new Date()) {
  return `tcu_timetable_${academicYear}_${range}_${formatFilenameDate(date)}.ics`;
}

export function downloadIcsFile(icsText: string, fileName: string) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadAcademicCalendarConfig(academicYear: number): Promise<AcademicCalendarConfig> {
  const response = await fetch(`/academic-calendar/${academicYear}.json`);
  if (!response.ok) {
    throw new Error(`academic calendar not found: ${academicYear}`);
  }

  const raw = (await response.json()) as Partial<AcademicCalendarConfig> & {
    quarters?: Partial<Record<AcademicQuarter, Partial<AcademicCalendarQuarterConfig>>>;
  };

  const timezone = typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : 'Asia/Tokyo';
  const config: AcademicCalendarConfig = {
    academicYear: typeof raw.academicYear === 'number' && Number.isFinite(raw.academicYear) ? raw.academicYear : academicYear,
    timezone,
    quarters: {
      '1Q': normalizeQuarterRange(raw.quarters?.['1Q'], { start: '', end: '' }),
      '2Q': normalizeQuarterRange(raw.quarters?.['2Q'], { start: '', end: '' }),
      '3Q': normalizeQuarterRange(raw.quarters?.['3Q'], { start: '', end: '' }),
      '4Q': normalizeQuarterRange(raw.quarters?.['4Q'], { start: '', end: '' }),
    },
  };

  return config;
}

export function createFallbackAcademicCalendarConfig(
  academicYear: number,
  quarterRanges: Record<AcademicQuarter, { start: string; end: string }>,
): AcademicCalendarConfig {
  return {
    academicYear,
    timezone: 'Asia/Tokyo',
    quarters: {
      '1Q': normalizeQuarterRange(undefined, quarterRanges['1Q']),
      '2Q': normalizeQuarterRange(undefined, quarterRanges['2Q']),
      '3Q': normalizeQuarterRange(undefined, quarterRanges['3Q']),
      '4Q': normalizeQuarterRange(undefined, quarterRanges['4Q']),
    },
  };
}

export function buildCalendarExportIcs(
  options: CalendarExportOptions,
  source: CalendarExportSource,
) {
  const quarters = resolveQuarterList(options.range);
  const events: string[] = [];

  for (const quarter of quarters) {
    const quarterConfig = getResolvedQuarterConfig(options.academicCalendar, quarter, options.quarterRanges);
    const startDate = toLocalDate(quarterConfig.start);
    const endDate = toLocalDate(quarterConfig.end);

    if (!startDate || !endDate || startDate > endDate) {
      continue;
    }

    const excludedDates = new Set(quarterConfig.excludedDates.map((value) => value.trim()).filter(Boolean));
    const rangeEnd = new Date(endDate.getTime());
    rangeEnd.setHours(23, 59, 59, 999);

    for (const day of source.days) {
      const weekday = mapDayToWeekdayIndex(day);
      if (weekday === null) {
        continue;
      }

      const firstOccurrence = getFirstOccurrence(startDate, weekday);
      if (firstOccurrence > rangeEnd) {
        continue;
      }

      for (const period of source.periods) {
        const cell = source.timetable[quarter]?.[day]?.[String(period.id)] ?? null;
        if (!cell || !cell.title) {
          continue;
        }

        const timeRange = parseTimeRange(period.time);
        if (!timeRange) {
          continue;
        }

        let occurrence = new Date(firstOccurrence.getTime());
        while (occurrence <= rangeEnd) {
          const dateKey = formatDateKey(occurrence);
          if (!shouldGenerateOccurrence(dateKey, excludedDates)) {
            occurrence = addDays(occurrence, 7);
            continue;
          }

          const startDateTime = combineDateAndTime(occurrence, timeRange.startHour, timeRange.startMinute);
          const endDateTime = combineDateAndTime(occurrence, timeRange.endHour, timeRange.endMinute);

          if (endDateTime <= startDateTime) {
            break;
          }

          const room = cell.room ?? cell.sourceOffering?.room;
          const teacher = cell.teacher ?? cell.sourceOffering?.teacher;
          const lines = buildEventLines({
            title: cell.title,
            academicYear: options.academicYear,
            academicYearLabel: source.academicYearLabel,
            rangeLabel: options.range,
            quarter,
            day,
            periodLabel: period.label,
            startDateTime,
            endDateTime,
            timezone: options.academicCalendar.timezone,
            room,
            teacher,
            memo: cell.memo,
            remarks: cell.remarks,
            alarmMinutes: options.alarmMinutes,
            includeRoom: options.includeRoom,
            includeTeacher: options.includeTeacher,
          });

          events.push(...lines);
          occurrence = addDays(occurrence, 7);
        }
      }
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CYLIU2003//Course-management-tool//JP',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(`TCU 時間割 ${source.academicYearLabel}`)}`,
    `X-WR-TIMEZONE:${escapeICSText(options.academicCalendar.timezone)}`,
    ...buildTimezoneBlock(options.academicCalendar.timezone),
    ...events,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
