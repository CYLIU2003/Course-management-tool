# 2026年度前期時間割CSV（理工学部）

このフォルダは、アップロードされた2026年度前期時間割PDFから抽出した、Course-management-tool向けの開講情報CSVです。

## 配置先

リポジトリ直下へコピーすると、以下のように配置されます。

```txt
public/department/rikou/2026/rikou_2026_spring_schedule.csv
public/department/rikou/2026/{departmentId}_2026_spring_schedule.csv
```

## CSV列

```csv
departmentId,sourceDepartment,day,period,term,gradeYear,className,title,teacher,lectureCode,room,target,remarks,requiredFlag,sourcePage
```

## 注意

このCSVは「開講情報」です。単位数・卒業要件・必修/選択必修の正本ではありません。単位数と卒業判定は、既存の `*_timetable_by_category.csv` と `*_credit_requirements.csv` を使ってください。

今回の自動抽出では、PDFの表セルに複数科目が入っている箇所について、講義コードを基準に行分割しています。複数教員・複数教室・折り返しのある科目名は、情報を失わないことを優先して連結している場合があります。最終利用前に、重要科目は画面上で確認してください。
