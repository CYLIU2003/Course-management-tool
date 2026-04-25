# Agent向け指示書: チーム開発用ブランチ作成と初期セットアップ

## 目的

Course-management-tool を4人体制で安全に開発できる初期状態にする。

- 代表者: PM / 全体設計 / レビュー
- 後輩A: Data班
- 後輩B: Core Logic班
- 後輩C: Mobile UI班

## 基本方針

- `main` は安定版 (デモ可能状態)
- `develop` は開発統合
- 各担当は `develop` から feature/data ブランチを切る
- `main` へ直接 push しない
- PR で `develop` に統合する

## 作成するブランチ

```text
main
develop

feature/project-structure
data/sample-curriculum
feature/core-gpa-and-credit-summary
feature/mobile-home-ui
```

## 各ブランチの役割

| ブランチ名 | 担当 | 目的 |
| --- | --- | --- |
| `main` | 代表者 | 安定版・発表/デモ可能版 |
| `develop` | 全員 | 開発統合用 |
| `feature/project-structure` | 代表者 | 初期構成・型定義・docs整備 |
| `data/sample-curriculum` | 後輩A | 科目データ・卒業要件データ作成 |
| `feature/core-gpa-and-credit-summary` | 後輩B | GPA計算・単位集計・時間割重複判定 |
| `feature/mobile-home-ui` | 後輩C | スマホ向けホーム画面・カードUI |

## 実行手順

### 1. 最新 main 取得

```bash
git checkout main
git pull origin main
```

### 2. develop 作成/更新

未作成の場合:

```bash
git checkout -b develop
git push -u origin develop
```

既存の場合:

```bash
git checkout develop
git pull origin develop
```

### 3. 代表者ブランチ

```bash
git checkout develop
git pull origin develop
git checkout -b feature/project-structure
git push -u origin feature/project-structure
```

### 4. 後輩Aブランチ

```bash
git checkout develop
git pull origin develop
git checkout -b data/sample-curriculum
git push -u origin data/sample-curriculum
```

### 5. 後輩Bブランチ

```bash
git checkout develop
git pull origin develop
git checkout -b feature/core-gpa-and-credit-summary
git push -u origin feature/core-gpa-and-credit-summary
```

### 6. 後輩Cブランチ

```bash
git checkout develop
git pull origin develop
git checkout -b feature/mobile-home-ui
git push -u origin feature/mobile-home-ui
```

## 初期ディレクトリ構成

```text
docs/
  ARCHITECTURE.md
  DATA_SCHEMA.md
  TASK_TEMPLATE.md
  PR_REVIEW_CHECKLIST.md
  BEGINNER_GUIDE.md
  team/
    README.md
    data-team-guide.md
    core-logic-team-guide.md
    mobile-ui-team-guide.md

src/
  core/
    types/
      course.ts
      grade.ts
      requirement.ts
      timetable.ts
    gpa/
      calculateGpa.ts
    credits/
      summarizeCredits.ts
    timetable/
      checkTimetableConflicts.ts

  components/
    mobile/
      MobileBottomNav.tsx
      GraduationRiskCard.tsx
      GpaSummaryCard.tsx
      CreditProgressCard.tsx
      CourseCard.tsx

  pages/
    mobile/
      MobileHomePage.tsx
      MobileCourseSearchPage.tsx
      MobileGradePage.tsx
      MobileSettingsPage.tsx

data/
  sample/
    courses.sample.json
    requirements.sample.json
    grades.sample.json

tests/
  core/
    calculateGpa.test.ts
    summarizeCredits.test.ts
    checkTimetableConflicts.test.ts
```

## 禁止事項

- `main` へ直接 push しない
- 後輩ブランチで共通型を勝手に変更しない
- UIにGPA計算/卒業判定ロジックを書かない
- 不明なデータ分類を勝手に確定しない
- PC用UIをそのままスマホ縮小しない
- 1PRで大量機能を同時変更しない

## 完了条件

- `develop` が存在
- 代表者/A/B/C 用ブランチが存在
- `docs/` の初期文書が存在
- `src/core/types/` の基本型が存在
- `data/sample/` が存在
- 各担当が自分のブランチで開始可能
