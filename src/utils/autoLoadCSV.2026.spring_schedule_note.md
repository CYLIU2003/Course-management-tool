# 2026年度前期時間割CSVの配置

このデータセットでは、既存 `csvImporter.ts` の `ClassScheduleRow` と互換になるように、以下のファイルを追加しています。

- `public/department/<facultyId>/2026/<departmentId>_2026_spring_schedule.csv`
- `public/department/<facultyId>/2026/<facultyId>_2026_spring_schedule.csv`
- `public/department/_catalog/spring_schedule_2026_all_campuses.csv`

現行 `autoLoadCSV.ts` は `paths.schedule` → `paths.sharedSchedule` の順で探索するため、全学部対応パッチ適用後は各学科の `departmentId` と `facultyId` から該当CSVを読み込めます。

照合キーは主に `normalizedTitle` です。既存実装の `normalizeCourseTitle()` と同じく、空白除去・NFKC正規化・括弧正規化を前提にしています。
