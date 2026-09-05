# Campus Note — 履修・時間割・成績管理

[![React](https://img.shields.io/badge/React-19.0-20232a.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg?logo=vite)](https://vitejs.dev/)

東京都市大学の4クォーター制に対応した、時間割作成・成績管理・卒業要件の進捗確認をまとめて行えるWebアプリです。

入学年度はカリキュラム・卒業要件を決める基準、現在学年は時間割・成績入力の表示対象を切り替える基準として分けています。

公式学修要覧（2022〜2026年度）119件とひらめきパンフレット6件を取り込み、SQLiteに出典付きで保存しました。「履修資料」で必要単位・履修条件・科目表・TAP／ATAP・教職の資料を検索できます。一般の学部生を基本に、**ひらめき・TAP／ATAP・教職を独立して複数選択**できます（全8通り）。収録範囲、更新手順、バックアップ、判定の制限は[開発ノート](docs/development_note_curriculum.md)を参照してください。


フロントを学生の日常操作から再設計しました。初回は学科・入学年度を確認し、科目検索の「追加」から空きコマを選んで登録できます。「成績・単位」で成績を直接入力し、履修ガイドで通常課程と追加プログラムの条件を確認できます。見た目と操作の規約は [DESIGN.md](DESIGN.md)、変更・検証は [UI再設計ノート](docs/development_note_ui.md) を参照してください。

---

アカウント登録ではユーザー名・パスワード・入学学科・年度を保存します。[アカウント・公開構成の開発ノート](docs/development_note_accounts.md)を参照してください。

公開版は **Cloudflare Workers Static Assets + Supabase Auth/PostgreSQL + 利用者別LocalStorage同期** に対応しています。SQLiteは公式資料の取込・監査とローカル開発に使います。Supabase版の登録ではメールアドレスも入力します。現在は公開先プロジェクト未設定のため未デプロイです。[公開・管理者設定手順](docs/deployment_cloudflare_supabase.md)を参照してください。

2026年度開講資料35件を保存し、8,576掲載行から3,706講義コードを重複なく収録しました。ただし97講義は条件付き訂正等の確認が残るため、確定時間割としての完全性は未達です。[原本照合・収録範囲](docs/development_note_offerings.md)を参照してください。管理画面には利用状況集計と問い合わせ回答機能があります。

## 目次

- [主な機能](#主な機能)
- [セットアップ](#セットアップ)
- [開発ブランチ方針](#開発ブランチ方針)
- [アーキテクチャ方針](#アーキテクチャ方針)
- [ディレクトリ構成](#ディレクトリ構成)
- [公式データの更新](#公式データの更新)
- [AI・LLM向け情報](#ai・llm向け情報)

---

## 主な機能

### 1. 時間割管理
- 1年次から4年次、大学院(M1, M2)まで切り替えて管理できます。
- 1Qから4Qまでの時間割を作成できます。
- 授業名、教場、担当教員、備考を登録できます。
- 学科選択時には、SQLite内のPDF照合済み科目から授業名を検索できます。
- 入学年度を切り替えると、SQLite APIから該当する学科・年度のデータを取得します。
- 現在学年は、1年次・2年次・3年次・4年次・M1・M2 の表示対象を切り替えます。

### 2. 成績・進捗管理
- 秀・優・良・可・不可を使ったGPAを自動計算します。
- 取得単位数を集計します。必選区分・算入条件の原本確認が未完了のため、卒業要件の自動達成判定は未判定と表示します。
- 将来の成績を仮定したGPA予測もできます。

### 3. SQLiteと原本の連携
- 科目・学修要覧・ひらめき・TAP情報はSQLite APIを参照します。
- `department/rikou` の自動読込、CSVで科目マスターを上書きする画面、CSVへのフォールバックを削除しました。
- 科目名と単位は原本PDFの文字位置で照合し、対象学科と入学年度を検査して取り込みます。
- 未確認行は検索候補から除外し、元の表・全文・PDFは参照できるように保存します。

### 4. 原本監査
- 科目名の先頭欠落、講義形式・G注記の混入、結合見出しによるページ欠落を修正しました。
- 到達目標の対応表・資格表を通常の教育課程表から分離しました。
- 全条件の確認完了ではありません。年度・学科別の検証件数と制限は[開発ノート](docs/development_note_curriculum.md)に記録しています。

### 5. データ保存と出力
- JSONで全年度データを保存・復元できます。
- ICS形式でカレンダーに出力できます。
- ログインしたアカウントに時間割・成績・設定を保存します。

### 6. カレンダー出力
- 1Q / 2Q / 3Q / 4Q / 前期 / 後期 / 年間 でICSファイルを出力できます。
- 通知時間は 0分 / 10分 / 30分前から選べます。
- 教室や担当教員の表示を切り替えられます。
- iPhone や Google Calendar に取り込める `text/calendar` 形式で保存されます。
- SQLiteの学年暦APIを参照して、クォーター期間と除外日を扱います。

---

## セットアップ

### 必要な環境
- Node.js 22.12以上（検証環境22.23.2）
- npm
- Python 3.11以上（検証環境3.14、SQLiteのJSON関数が必要）

### 起動手順

```bash
npm ci
python -m pip install -r backend/requirements.txt -r scripts/curriculum/requirements.txt
npm run db:build
npm run dev
```

起動後、`http://localhost:5173/` を開いてください。開発起動はViteとSQLite API（127.0.0.1:8000）を同時に立ち上げます。公式データのダウンロード済みファイルがない場合は、先に[再収集手順](docs/development_note_curriculum.md#再収集と更新)を実行してください。

### ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。`npm start` でSQLite APIとビルド済み画面を `http://127.0.0.1:8000/` に配信します。SQLite機能は静的ファイル配信のみでは動作しません。

### 診断コマンド

PowerShell からシステム全体の状態を確認できます。

```bash
npm run check:status
npm run check:csv
npm run check:all
```

---

## 開発ブランチ方針

- `main`: 安定版（発表/デモ可能）
- `develop`: 開発統合
- `feature/*`: 個別作業

### 基本フロー

```text
feature/* -> Pull Request -> develop -> 動作確認後 -> main
```

### 作業開始コマンド

```bash
git switch develop
git pull origin develop

git switch -c feature/mobile-course-card
```

### ブランチ種別

```text
feature/機能名
fix/バグ修正
docs/文書
refactor/整理
data/データ作成
experiment/実験
```

### 既存運用からの移行メモ

- `main_mobile` は新規作業の起点にせず、以後は `feature/mobile-*` へ統一します。

### ブランチ切り替え

```bash
git switch main
git switch develop
```

---

## アーキテクチャ方針

- 共通ロジックは `src/core/` を入口として集約します。
- PC向けUIとモバイル向けUIは画面/コンポーネントを分離し、ロジックは共有します。
- 卒業判定、GPA計算、時間割衝突判定、ICS出力をUIに直接書かない運用にします。

詳細は以下を参照してください。

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_SCHEMA.md`
- `docs/MOBILE_UI_GUIDE.md`
- `docs/PC_UI_GUIDE.md`
- `docs/TASK_TEMPLATE.md`
- `docs/PR_REVIEW_CHECKLIST.md`
- `docs/CONTRIBUTING.md`

---

## ディレクトリ構成

```text
backend/                 SQLiteスキーマ・インポート・HTTP API
data/curriculum.sqlite3   実行用DB（Git管理外）
data/import/             検証済み科目のインポート用データ
public/handbooks/        原本PDF・抽出全文・出典目録
scripts/curriculum/      原本収集・抽出・位置照合・テスト
src/api/                 SQLite APIクライアント
src/core/                型・学科定義・履修ロジック
src/components/          画面
```

## 公式データの更新

原本の収集 → 抽出 → `verify_pdf_courses.py`で照合 → `npm run db:build` → テストの順に実行してください。具体的なコマンドと判定範囲は[開発ノート](docs/development_note_curriculum.md#再収集と更新)を参照してください。

旧CSVと旧変換スクリプトは比較用に残していますが、アプリと現行DBビルドの入力には使いません。学科追加は `src/core/departments.ts` と該当年度の公式出典・対象範囲を更新し、DBを再構築します。

---

<details>
<summary><b>AI・LLM向け情報</b></summary>

機械向けに、実装の中心を短く整理しています。

- コアロジック: `src/utils/academicProgress.ts`
- 主要UI: `src/components/AcademicOverview.tsx`, `src/components/GpaPredictionPanel.tsx`, `src/components/GradeManagement.tsx`
- データ参照: `src/api/curriculum.ts`, `src/api/handbooks.ts`, `backend/database.py`
- 主な型: `AcademicCourse`, `AcademicCourseCell`, `AcademicDashboardSnapshot`
- GPA計算: `calculateCurrentGpa`, `predictGpa`
- 卒業要件警告: `generateGraduationWarnings`
- 原本照合: `scripts/curriculum/verify_pdf_courses.py`。未確認条件を自動認定しない。

</details>


### 公開前の検証と環境分離

Node 22.23.2を使用します。`npm run dev`はローカルPython/SQLite、`npm run dev:supabase`はSupabase stagingです。公開前は`npm run verify:cloudflare`でSQL/RLS・環境分離・ビルド・assets容量を検査します。Cloudflareは`main`をproduction、`feature/*`をstaging接続のpreviewとして扱います。設定値と管理者SQL、データ生成順序は[公開手順](docs/deployment_cloudflare_supabase.md)に統一しています。Python運営依存は`requirements-ops.txt`から導入できます。
