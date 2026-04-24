# 🎓 時間割・成績管理アプリ

[![React](https://img.shields.io/badge/React-19.0-20232a.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg?logo=vite)](https://vitejs.dev/)

東京都市大学の4クォーター制に対応した、時間割作成・成績管理・卒業要件の進捗確認をまとめて行えるWebアプリです。

入学年度はカリキュラム・卒業要件を決める基準、現在学年は時間割・成績入力の表示対象を切り替える基準として分けています。

---

## 目次

- [主な機能](#主な機能)
- [セットアップ](#セットアップ)
- [ディレクトリ構成](#ディレクトリ構成)
- [CSVファイルの規則](#csvファイルの規則)
- [AI・LLM向け情報](#ai・llm向け情報)

---

## 主な機能

### 1. 時間割管理
- 1年次から4年次、大学院(M1, M2)まで切り替えて管理できます。
- 1Qから4Qまでの時間割を作成できます。
- 授業名、教場、担当教員、備考を登録できます。
- 学科選択時には、CSVの科目一覧から授業名を検索して入力できます。
- 入学年度を切り替えると、該当年度のカリキュラム・卒業要件CSVを優先して読み込みます。
- 現在学年は、1年次・2年次・3年次・4年次・M1・M2 の表示対象を切り替えます。

### 2. 成績・進捗管理
- 秀・優・良・可・不可を使ったGPAを自動計算します。
- 取得単位数と残り必要単位数を自動集計します。
- 必修・選択必修・選択ごとの進捗を見やすく表示します。
- 卒業要件に足りない項目がある場合は警告を表示します。
- 将来の成績を仮定したGPA予測もできます。

### 3. CSV連携
- 起動時に `public/department/rikou/` のCSVを自動読み込みします。
- 電気電子通信工学科（`denki`）と機械工学科（`kikai`）を切り替えて読めます。
- 卒業要件CSVと科目一覧CSVを分けて管理できます。

### 4. PDF→CSV補助
- PDFの直接取り込みはアプリ本体に入れていません。
- 変換補助は `scripts/curriculum/` に置きます。
- 生成したCSVは人間が確認してから `public/department/rikou/` に配置します。

### 5. データ保存と出力
- JSONで全年度データを保存・復元できます。
- ICS形式でカレンダーに出力できます。
- LocalStorageに自動保存されます。

---

## セットアップ

### 必要な環境
- Node.js 20以上
- npm

### 起動手順

```bash
npm install
npm run dev
```

起動後、`http://localhost:5173/` を開いてください。

### ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。

---

## ディレクトリ構成

```text
Course-management-tool/
├── public/
│   └── department/rikou/
│       ├── denki_credit_requirements.csv
│       ├── denki_timetable_by_category.csv
│       ├── kikai_credit_requirements.csv
│       └── kikai_timetable_by_category.csv
├── scripts/
│   └── curriculum/
│       ├── README.md
│       └── parse-kikai-2026.ts
├── src/
│   ├── components/
│   │   ├── AcademicOverview.tsx
│   │   ├── CSVImporter.tsx
│   │   ├── CourseList.tsx
│   │   ├── GpaPredictionPanel.tsx
│   │   └── GradeManagement.tsx
│   ├── utils/
│   │   ├── academicProgress.ts
│   │   ├── autoLoadCSV.ts
│   │   └── csvImporter.ts
│   ├── App.tsx
│   ├── TimetableApp.tsx
│   └── main.tsx
├── README.md
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## CSVファイルの規則

- 卒業要件CSV: `{学科ID}_credit_requirements.csv`
- 科目一覧CSV: `{学科ID}_timetable_by_category.csv`
- 例: `denki_credit_requirements.csv` / `denki_timetable_by_category.csv`
- 例: `kikai_credit_requirements.csv` / `kikai_timetable_by_category.csv`
- 配置先: `public/department/rikou/`

新しい学科を追加する場合は、上記のCSVを用意したうえで `src/utils/autoLoadCSV.ts` の `AVAILABLE_DEPARTMENTS` に学科情報を追加してください。
PDFからCSVを作る場合は、まず `scripts/curriculum/` で生成してから、内容を確認して `public/department/rikou/` にコピーしてください。

---

<details>
<summary><b>AI・LLM向け情報</b></summary>

機械向けに、実装の中心を短く整理しています。

- コアロジック: `src/utils/academicProgress.ts`
- 主要UI: `src/components/AcademicOverview.tsx`, `src/components/GpaPredictionPanel.tsx`, `src/components/GradeManagement.tsx`
- CSV読み込み: `src/utils/csvImporter.ts`, `src/utils/autoLoadCSV.ts`
- 主な型: `AcademicCourse`, `AcademicCourseCell`, `AcademicDashboardSnapshot`
- GPA計算: `calculateCurrentGpa`, `predictGpa`
- 卒業要件警告: `generateGraduationWarnings`
- 学科追加: `public/department/rikou/{学科ID}_credit_requirements.csv` と `public/department/rikou/{学科ID}_timetable_by_category.csv` を配置し、`AVAILABLE_DEPARTMENTS` に登録

</details>
