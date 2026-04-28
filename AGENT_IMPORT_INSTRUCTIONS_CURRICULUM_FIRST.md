# Agent import instruction - curriculum-first version

1. Copy `public/department` into the app's `public/department`.
2. Replace `src/utils/autoLoadCSV.ts` with the file in this package.
3. Do not remove extra CSV columns; PapaParse and current parser ignore unknown columns, but they are needed for review.
4. Use `departmentId` from `public/department/_catalog/departments_2026.csv`.
5. For 2026 entrants, call `autoLoadDepartmentCSVs(departmentId, 2026)`.
6. Treat rows with `sourceKind=schedule-derived` and `credits=0` as display/matching helpers only, not as final graduation-counting curriculum rows.
7. Before graduation checks, review `curriculum_validation_matrix_2026.csv` and `rules_2026.json`.
