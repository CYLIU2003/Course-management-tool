# TCU 2026 Curriculum Data - Complete Seed for Course-management-tool

このパッケージは、アップロードされた2026年度学修要覧PDF群から、`CYLIU2003/Course-management-tool` が読み込めるCSV形式へ変換したものです。

## 収録内容

- `public/department/_catalog/departments_2026.csv` - 2026年度の全学部・全学科マスタ
- `public/department/<facultyId>/2026/<departmentId>_credit_requirements.csv` - 卒業要件
- `public/department/<facultyId>/2026/<departmentId>_timetable_by_category.csv` - 科目表
- `public/department/_catalog/rules_2026.json` - 現行CSVでは表現しにくいコース別条件・横断条件
- `public/department/_catalog/course_catalog_extracted_2026.csv` - PDFから抽出した全科目の拡張カタログ
- `src/utils/autoLoadCSV.2026.complete_patch.ts` - 全学部対応の読み込みパッチ案
- `validation_summary.csv` - 学科別の出力件数
- `extraction_review_flags.csv` - 自動抽出上、目視確認が望ましい行

## 重要な実装メモ

現行アプリの `autoLoadCSV.ts` は `/department/rikou` 固定の設計です。全学部で使うには、同梱の `autoLoadCSV.2026.complete_patch.ts` を参考に `facultyId` を導入してください。

## 注意

この変換はPDF本文・表からの自動抽出を含みます。卒業判定に直結する条件は、`rules_2026.json` と原本PDFを併用して確認してください。とくに人間科学部のコース別条件、情報工学部の一般/国際コース条件、数理・データサイエンスプログラム条件は、現行CSVだけでは完全表現できないためJSONに分離しています。
