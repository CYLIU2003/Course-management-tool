---
name: Campus Note
version: alpha
description: 東京都市大学の学生が日々の履修を管理する個人用ノート
colors:
  primary: "#146b68"
  on-primary: "#ffffff"
  text: "#182d3d"
  secondary: "#526777"
  background: "#f3f6f8"
  surface: "#ffffff"
  container: "#e4f3ef"
  border: "#dbe4e9"
typography:
  heading:
    fontFamily: Noto Sans JP
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: Noto Sans JP
    fontSize: 1rem
    lineHeight: 1.8
rounded:
  sm: 8px
  md: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    height: 44px
---

## Overview

学生の個人ノート。大学公式の履修登録システムとは区別する。
初回は学科・入学年度を確認、日常は時間割、学期末は成績入力へ進む。
主ナビゲーションはホーム・時間割・成績／単位・履修ガイドの4項目。
設定とバックアップはヘッダーの設定からアクセスする。

## Colors

白と青みのある紙色を土台に、青緑を主操作へ使う。赤は削除・入力エラーに限定。
状態を色だけで伝えず、文言を添える。未確認の条件を緑の達成表示にしない。

## Typography

日本語の読みやすさを優先し、主見出し24〜34px、項目14〜16px、補足12pxを基本とする。
数値は桁を揃える。意味のない英語ラベルや内部IDを説明に使わない。

## Layout

最大1280px。PCは科目検索320pxと時間割の2列、760px以下は縦積み。
ホームは主操作・記録3項目・今期予定・確認事項の順。重複する警告と未判定カードを並べない。
モバイルは4項目の固定ナビ。表だけを横スクロール可能にし、ページ全体は横にはみ出させない。

## Elevation & Depth

カードの境界は薄い線、影は控えめ。モーダルだけ明確に背景から分離する。

## Shapes

カード16px、入力とボタン8px。装飾は静的なカレンダー図形に限る。

## Components

- 初回案内: 学科・入学年度・表示学年の意味を説明。確定前の初期値を本人の属性と扱わない。
- 科目検索: 科目名と単位、追加ボタン。出典は詳細を開いて読む。
- 追加: 科目を選ぶ→空きコマ→内容確認→保存。既存授業は上書きしない。
- 編集: native dialogでフォーカスを閉じ込め、Escとキャンセルで破棄。科目名を必須にする。
- 成績: 学年ごとの科目行から直接入力。同じ科目の複数Qはまとめて更新。
- 空状態: 次にできる操作を示す。未入力GPAは0.00ではなくダッシュ。
- 不足情報: 必選・算入の未確認を詳細とガイドで明示し、履修可否や卒業を断定しない。

## Do's and Don'ts

主操作はひとつに絞る。44px以上の操作領域とキーボードフォーカスを確保。
開講時刻や履修可否を推測しない。学科変更だけで学生の時間割を消さない。
学科・年度変更時に古い選択中科目を新しい対象へ持ち越さない。
大学への履修登録とこのアプリへの記録を混同させない。

形式の参考: https://github.com/google-labs-code/design.md （2026-09-05参照）。
機械可読トークンと設計意図を併記する方式を採用。見本の外観は流用していない。
