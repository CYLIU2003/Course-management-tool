# API_CONTRACT

将来の backend 分離に向けた暫定 API 契約。

## Graduation

- `POST /api/graduation/check`
  - request: `allYearsData`, `courses`, `curriculum`
  - response: `statuses`, `missingCredits`, `riskSummary`

## GPA

- `POST /api/gpa/calculate`
  - request: `allYearsData`
  - response: `currentGpa`, `currentGradedCredits`, `currentEarnedPoints`

- `POST /api/gpa/predict`
  - request: `currentGradedCredits`, `currentEarnedPoints`, `targetCourses`
  - response: `predictedGpa`, `addedCredits`

## Timetable

- `POST /api/timetable/check-conflicts`
  - request: `timetable`
  - response: `conflicts[]`

## Calendar

- `POST /api/calendar/export-ics`
  - request: `options`, `source`
  - response: `text/calendar`
