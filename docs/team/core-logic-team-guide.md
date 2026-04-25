# Core Logic班 説明書

## 役割

Core Logic班は、UIではなく純粋な計算関数を担当します。

1. GPA計算
2. 区分別単位集計
3. 時間割重複判定
4. 最低限の単体テスト

## 作業ブランチ

`feature/core-gpa-and-credit-summary`

```bash
git checkout develop
git pull origin develop
git checkout feature/core-gpa-and-credit-summary
git pull origin feature/core-gpa-and-credit-summary
```

ブランチが無い場合:

```bash
git fetch origin
git checkout feature/core-gpa-and-credit-summary
```

## 作成ファイル

- `src/core/gpa/calculateGpa.ts`
- `src/core/credits/summarizeCredits.ts`
- `src/core/timetable/checkTimetableConflicts.ts`
- `tests/core/calculateGpa.test.ts`
- `tests/core/summarizeCredits.test.ts`
- `tests/core/checkTimetableConflicts.test.ts`

## 1. calculateGpa.ts

要件:

- 入力: `GradeRecord[]`
- 出力: `GpaResult`
- `未履修` は計算対象外
- `D` と `F` は earnedCredits に含めない
- 空配列でも落ちない

計算ルール:

- `S=4.0`, `A=3.0`, `B=2.0`, `C=1.0`, `D/F=0.0`

## 2. summarizeCredits.ts

要件:

- 入力: `Course[]`
- 出力: `Record<string, number>`
- `category` ごとに `credits` を合計

## 3. checkTimetableConflicts.ts

要件:

- 入力: `TimetableSlot[]`
- 出力: `TimetableConflict[]`
- 同じ `day + period` に複数科目があれば衝突として返す

## テスト方針

- 「この入力ならこの出力」を確認する小さなテストを優先
- まず正常系、次に空配列などの境界ケース

## ゴール

- `calculateGpa()` が動く
- `summarizeCredits()` が動く
- `checkTimetableConflicts()` が動く
- それぞれの簡易テストが通る

## 禁止事項

- Reactコンポーネントを作らない
- UIに計算ロジックを書かない
- 共通型を独断で大きく変更しない
- エラーを放置しない
- `main` へ直接pushしない

## コミット例

```bash
git add .
git commit -m "feat: add gpa calculator"
git push origin feature/core-gpa-and-credit-summary
```
