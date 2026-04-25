# Mobile UI班 説明書

## 役割

Mobile UI班は、スマホ向けの見やすい画面を作る担当です。

1. 下部タブ
2. ホーム画面
3. 卒業リスクカード
4. GPAカード
5. 不足単位カード
6. 科目カード

## 作業ブランチ

`feature/mobile-home-ui`

```bash
git checkout develop
git pull origin develop
git checkout feature/mobile-home-ui
git pull origin feature/mobile-home-ui
```

ブランチが無い場合:

```bash
git fetch origin
git checkout feature/mobile-home-ui
```

## 作成ファイル

- `src/components/mobile/MobileBottomNav.tsx`
- `src/components/mobile/GraduationRiskCard.tsx`
- `src/components/mobile/GpaSummaryCard.tsx`
- `src/components/mobile/CreditProgressCard.tsx`
- `src/components/mobile/CourseCard.tsx`
- `src/pages/mobile/MobileHomePage.tsx`

## 1. MobileBottomNav

タブ構成 (5つ以内):

- ホーム
- 時間割
- 科目
- 成績
- 設定

要件:

- スマホ下部に固定
- 現在タブが分かる
- タップしやすいサイズ

## 2. GraduationRiskCard

3段階表示:

- 安全
- 注意
- 危険

要件:

- 色だけでなく文章で説明
- 何が不足かを短文で表示

## 3. GpaSummaryCard

要件:

- 現在GPA / 予測GPA / 目標GPA を表示
- 数字を見やすく大きめに表示
- まずはダミーデータで可

## 4. CreditProgressCard

要件:

- 取得済み / 必要 / 不足単位 を表示
- 可能なら区分別不足も追加

## 5. CourseCard

要件:

- 表ではなくカード
- 科目名を最上位に表示
- 区分と単位を明確に表示
- タップしやすいサイズ

## 6. MobileHomePage

初期配置:

1. GraduationRiskCard
2. CreditProgressCard
3. GpaSummaryCard
4. CourseCard (2〜3件)
5. MobileBottomNav

## UI基本ルール

- 1カラム
- 横スクロール禁止
- カード中心
- 重要情報を上に配置
- 警告は色+文章で表現

## ダミーデータ方針

初期は API 接続不要。固定サンプル値で表示確認してよい。

## 禁止事項

- UI内にGPA計算ロジックを書かない
- UI内に卒業判定ロジックを書かない
- PC表をそのまま縮小しない
- 共通型を勝手に変更しない
- `main` へ直接pushしない

## ゴール

スマホ画面で以下が見えること:

- 卒業リスク
- 不足単位
- GPA
- 科目カード
- 下部タブ

## コミット例

```bash
git add .
git commit -m "feat: add mobile home page ui"
git push origin feature/mobile-home-ui
```
