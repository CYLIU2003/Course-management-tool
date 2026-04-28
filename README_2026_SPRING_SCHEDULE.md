# 2026年度前学期 時間割CSV 追加版

## 概要

このZIPは、先に作成した2026年度履修要件・科目マスタに、以下2つの時間割PDFから抽出した2026年度前学期時間割を追加したものです。

- `2026世田谷キャンパス前期.pdf`
- `2026横浜キャンパス前期.pdf`

時間割PDFの列構造は、`学科 / 曜 / 限 / 学期 / 年 / クラス / 科目名 / 担当者 / 講義コード / 教室 / 受講対象 / 備考` です。抽出CSVは既存 `ClassScheduleRow` に合わせつつ、履修情報と照合するための補助列を追加しています。

## 主要ファイル

- `public/department/_catalog/spring_schedule_2026_all_campuses.csv`
  - 全キャンパス・全学科をまとめた統合版
- `public/department/<facultyId>/2026/<departmentId>_2026_spring_schedule.csv`
  - 学科別に読み込む実運用用CSV
- `schedule_validation_summary_2026_spring.csv`
  - 学科別の抽出件数・講義コード件数・科目マスタ照合率
- `schedule_unmatched_review_2026_spring.csv`
  - 科目名照合できなかった行。再履修・旧カリキュラム・教養特別講義・英語クラス・集中講義が多く含まれます。

## 抽出件数

- 総行数: 5080
- 世田谷キャンパス: 2829
- 横浜キャンパス: 2251

## 照合方針

`lectureCode` は時間割上の講義コードであり、履修要覧側の科目IDとは一致しないため、主照合キーは `normalizedTitle` です。

照合ステータス:

- `exact`: 正規化科目名が完全一致
- `normalized`: 再履修表記・国際表記・a/b表記などを正規化して一致
- `fuzzy`: 類似度0.86以上で一致
- `unmatched`: 現行科目マスタに存在しない、または名称差分が大きい

## 注意

PDF由来の時間割は表内改行が多いため、教室・担当者・備考が複数行に分かれる科目では、補助的に結合しています。最終的な本番投入前に `schedule_unmatched_review_2026_spring.csv` を確認してください。
