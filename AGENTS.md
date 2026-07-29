# AGENTS.md

## 適用範囲

このファイルはリポジトリ全体に適用する。  
このプロジェクトは「時間割表示アプリ」ではなく、東京都市大学の入学年度・所属学科・履修実績・特別プログラムを統合して、履修計画を支援するアプリである。

## 作業開始時に必ず実行すること

```bash
git fetch origin
git switch agent/course-rules-and-program-support
git pull --ff-only origin agent/course-rules-and-program-support

npm ci
npm run sources:plan
npm run check:all
npm run lint
```

別ブランチで作業する場合も、必ず上記ブランチまたは `main` の最新状態から派生させる。  
既存PR #2へ追加する作業でない限り、`main`へ直接コミットしない。

## 最初に読むファイル

次の順番で読むこと。

1. `docs/LOCAL_AGENT_HANDOFF_2026.md`
2. `docs/source-manifest-2026.json`
3. `docs/CURRICULUM_RULE_MODEL.md`
4. `src/core/courseRecords.ts`
5. `src/api/requirements.ts`
6. `src/utils/autoLoadCSV.ts`
7. `src/utils/csvImporter.ts`
8. `src/components/GraduationRequirementPanel.tsx`

## このプロジェクトで最優先する原則

### 1. 公式要件を推測しない

科目名、卒業要件、進級条件、TAP、ATAP、TUCP、ひらめき、国際イノベーターの条件を、名称や過年度資料から推測して実装してはならない。

資料の優先順位は次のとおり。

1. ポータルの正誤表・変更通知
2. 対象入学年度の学修要覧・履修要綱
3. 対象年度の授業時間表・訂正表
4. 対象年度の公式プログラム募集要項・ハンドブック
5. 大学・学部・学科の公式Webページ
6. 過年度の公式資料

下位資料と上位資料が矛盾する場合は、上位資料を採用し、差異を記録する。

### 2. 出典をデータと一緒に保存する

新しいルールまたは科目対応表には、最低限次を保持する。

```ts
type SourceMetadata = {
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceYear?: number;
  sourcePage?: number;
  checkedAt: string;
  confidence: 'confirmed' | 'provisional' | 'historical';
  reviewStatus: 'verified' | 'needs_human_review';
};
```

`provisional` または `historical` の資料だけを根拠に、画面上で「達成済み」「修了済み」と断定してはならない。  
その場合は `needs_confirmation` または同等の状態を表示する。

### 3. 通常カリキュラムと特別プログラムを混ぜない

TAP、ATAP、TUCP、ひらめき、国際イノベーターは、所属学科の卒業要件を置き換えない。

- 所属学科カリキュラム: 卒業・進級・卒業研究着手の正本
- 特別プログラム: 追加条件、認定単位、留学期間、履修衝突のオーバーレイ
- 単位認定: 所属学部・学科の公式区分が確認できた場合だけ卒業要件へ算入
- 未確認の認定科目: 単位候補として表示するが、自動算入しない

### 4. 一つの科目を二重計上しない

卒業要件計算では次を守る。

- 科目ID・講義コードを最優先して同一科目を識別する
- 次に正規化した科目名・別名で照合する
- 同一科目の状態は `取得済 > 履修予定 > 不可` の優先順位で統合する
- 一つの科目は一つの卒業要件区分にだけ割り当てる
- 区分の必要単位を超えた分だけ、自由選択へ回す
- `不可`、`未履修`、`courseType=unknown` は取得済単位へ加算しない
- 学部卒業判定に `M1`・`M2` の科目を加算しない
- 同名でも科目コードが異なり、別科目として再編された可能性がある場合は人間確認へ回す

### 5. 進級・卒業研究着手・卒業を別々に判定する

次を一つの合否へまとめてはならない。

- 3年次進級
- 4年次進級
- 卒業研究(1)着手
- 卒業研究(2)着手
- 卒業
- 特別プログラム修了

在学年数や学科承認など、履修データだけでは確認できない条件は自動合格にしない。

## 現在の優先作業

### P0: 2026年度年間時間割を完成させる

1. `docs/source-manifest-2026.json` の公式PDFを取得する
2. 世田谷キャンパス後期全学科PDFを解析する
3. 学科別の後期CSVを生成する
4. 横浜キャンパス時間割へ訂正PDFを適用する
5. 前期・後期・集中・通年を同じ科目マスタへ結合する
6. 未結合・曖昧一致・重複を診断レポートへ出す

取得コマンド:

```bash
npm run sources:fetch
```

特定資料だけ取得する場合:

```bash
node scripts/sources/download-official-2026.mjs \
  --only=tcu-2026-setagaya-back-all,tcu-2026-denki-handbook
```

### P0: 電気電子通信工学科の2026年度ルールを構造化する

`docs/LOCAL_AGENT_HANDOFF_2026.md` の確定値を実装し、次を別々に判定する。

- 3年次進級: 総単位60
- 4年次進級: 総単位100と区分別内訳
- 卒業研究(1): 原則4年次進級条件
- 卒業研究(2): 卒業研究(1)修得
- 卒業: 総単位124と区分別内訳
- DS/MS: 合計4、DSを1以上
- 理工学基礎31超過分の自由選択算入

総単位だけで達成扱いにしてはならない。

### P1: 特別プログラムをデータ駆動にする

現在 `src/core/programs.ts` にある補助ロジックを、入学年度・所属学科・出典つきのデータへ移す。

対象:

- TAP
- ATAP
- TUCP
- ひらめき
- 国際イノベーター育成オナーズプログラム

画面上で、次を区別する。

- 確認済み条件
- 条件を満たしていない
- データ不足
- 公式資料の人間確認が必要

### P1: 自動テストを追加する

最低限、次のテストを追加する。

- 同一科目を複数Qへ登録しても一度だけ数える
- 不可は取得単位へ数えない
- 取得済が履修予定より優先される
- 一科目を複数区分へ重複算入しない
- 区分超過分だけ自由選択へ回る
- 4年次進級の内訳不足を検出する
- DS合計不足とDS1単位不足を別々に検出する
- TAP留学期間と通常授業の衝突を警告する
- provisional資料だけでは修了済みにしない

## 授業時間表の正規化規則

元表記は必ず保存したうえで、検索用に次を付加する。

| 公式表記 | quarter |
|---|---|
| 前期前 | 1Q |
| 前期後 | 2Q |
| 後期前 | 3Q |
| 後期後 | 4Q |
| 前期 | 1Q・2Q候補 |
| 後期 | 3Q・4Q候補 |
| 通年 | 1Q～4Q |
| 前集中 | front-intensive |
| 後集中 | back-intensive |
| 集中 | intensive |

既存CSVの必須列は次のとおり。

```text
departmentId,sourceDepartment,day,period,term,gradeYear,className,title,
teacher,lectureCode,room,target,remarks,requiredFlag,sourcePage
```

複数曜日・複数時限の対開講は、一つの開講を複数スロットへ展開してよいが、同一 `offeringId` を共有させる。  
担当者、教室、対象年度、備考を落とさない。

## PDF解析の規則

1. まずテキストレイヤーを使う
2. 表構造が崩れたページだけ画像を確認する
3. OCRを最初から全面適用しない
4. 自動抽出結果をそのまま確定データにしない
5. 行数、講義コード重複、科目名欠損、曜日時限欠損を検証する
6. 元PDFページ番号を各行へ保持する
7. 訂正表は上書き前後を監査ログへ残す

## リポジトリ運用

禁止事項:

- リポジトリ直下へ `fix*.js`、`patch*.js`、`F*.cjs` のような一時置換スクリプトを置く
- 正規表現による無検証のソース全文置換
- `git add -A` で関係ない変更まで含める
- CI失敗のままPRをレビュー可能にする
- 公式資料未確認の数値を「たぶん」で埋める
- `TimetableApp.tsx` の全面書き換えをデータ整備と同じPRで行う

一時スクリプトが必要な場合は `scripts/` 配下へ置き、入力、出力、再実行性、削除時期をREADMEへ記載する。

## 必須検証

変更後は必ず実行する。

```bash
npm run check:status
npm run check:csv
npm run build
npm run lint
```

データ変更では追加で次を確認する。

- 対象学科のCSV読み込みが `success` または意図した `partial`
- `unknownCourseTypes`
- `unmatchedOfferings`
- `ambiguousMatches`
- 重複講義コード
- 0単位科目
- 欠損した曜日・時限・学期
- 公式資料と抽出件数の差

## 完了報告の形式

ローカルAIは作業終了時に次を報告する。

```text
変更概要:
変更ファイル:
使用した公式資料:
確認日:
自動判定可能にした範囲:
人間確認が必要な範囲:
実行した検証:
検証結果:
残課題:
```

不明点があっても作業全体を停止しない。  
確認済み部分を実装し、不明部分を `needs_confirmation` として明示したうえで続行する。
