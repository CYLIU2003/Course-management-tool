# TCU 2026 Curriculum-first rebuild

作成日時: 2026-04-27T07:00:09

このパッケージは、2026年度学修要覧の「教育課程表」を主データ、2026年度前期時間割を開講データとして分離し直した版です。

## 今回の修正点

1. `src/utils/autoLoadCSV.ts` を **実際に差し替え可能なファイル名** で同梱しました。前回の patch ファイルを読むだけではアプリに反映されないためです。
2. 全19学科を `AVAILABLE_DEPARTMENTS` に登録しました。
3. すべての `timetable_by_category.csv` に `sourceKind` / `sourceQuality` を追加し、教育課程表PDF由来か時間割由来かを判別できるようにしました。
4. `spring_schedule_2026_all_campuses.csv` には `curriculumCourseId` を追加し、時間割から教育課程表側へ照合できるようにしました。
5. `curriculum_validation_matrix_2026.csv` で各学科の反映状態を確認できます。

## 重要な注意

理工学部7学科+自然科学科2コースについては、今回アップロードされた資料に「学科別教育課程表PDF」が含まれていませんでした。そのため、該当学科は以下の構成です。

- 理工・建築都市デザイン・情報工学部共通分野PDF由来の共通科目
- 2026年度世田谷キャンパス前期時間割から抽出した補助科目

補助科目は `sourceKind=schedule-derived`、`credits=0` としています。卒業判定に使う前に、理工学部の学科別教育課程表PDFを追加して再生成してください。

## 導入方法

1. `public/department` をプロジェクトの `public/department` にコピーします。
2. `src/utils/autoLoadCSV.ts` をプロジェクトの同名ファイルへ置換します。
3. アプリで `autoLoadDepartmentCSVs(departmentId, 2026)` を呼びます。
4. `curriculum_validation_matrix_2026.csv` で各学科の行数・照合率を確認します。

## 主要ファイル

- `public/department/_catalog/departments_2026.csv`
- `public/department/_catalog/curriculum_course_master_2026.csv`
- `public/department/_catalog/spring_schedule_2026_all_campuses.csv`
- `public/department/_catalog/curriculum_validation_matrix_2026.csv`
- `public/department/_catalog/rules_2026.json`
- `src/utils/autoLoadCSV.ts`

