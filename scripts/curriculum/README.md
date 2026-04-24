# Curriculum CSV Generation

このフォルダは、履修要覧PDFからCSVを生成するための補助スクリプト置き場です。

方針:
- PDFの直接取り込みはアプリ本体に入れない
- まず `scripts/curriculum/` でCSVを生成する
- 生成結果を人間が確認してから `public/department/rikou/` に配置する
- アプリ本体は既存のCSVローダーで読む

実運用では、PDFの版ごとに変換スクリプトを分け、生成物は `generated/` に出力します。

## 2026年度前期時間割CSV

時間割の開講情報は、次のファイル名で `public/department/rikou/2026/` に置く想定です。

- `rikou_2026_spring_schedule.csv`
- 学科別に分ける場合は `denki_2026_spring_schedule.csv` なども読み込み対象にできます

想定列は以下です。

- `departmentId`
- `sourceDepartment`
- `day`
- `period`
- `term`
- `gradeYear`
- `className`
- `id`
- `title`
- `teacher`
- `lectureCode`
- `room`
- `target`
- `remarks`
- `credits`
- `raw_required`
- `category`
- `group`
- `courseType`
- `requiredFlag`
- `sourcePage`

アプリ本体は、この CSV が無くても動作し、存在する場合だけ開講情報を科目一覧と編集モーダルに反映します。