# ARCHITECTURE

## 目的

本プロジェクトは「共通コア + UI分離」を前提に段階移行する。

- 共通コア: 卒業要件判定、GPA計算、時間割判定、カレンダー出力
- PC UI: 管理・一覧・詳細確認に最適化
- Mobile UI: 日常利用の判断導線に最適化

## 現在の移行方針

1. 既存ロジックは `src/core` を入口として利用する。
2. `src/utils` は実装本体として残し、段階的に core 配下へ移す。
3. UI は desktop/mobile で責務分離し、ロジックを重複実装しない。

## 依存ルール

1. UIコンポーネントからは core 経由でロジックを参照する。
2. core は React と DOM へ依存しない。
3. 卒業判定・GPA・衝突判定は UI ファイルに書かない。

## レイヤー

```text
src/
  core/
    graduation/
    gpa/
    courses/
    timetable/
    calendar/
  components/
    desktop/
    mobile/
  pages/
    desktop/
    mobile/
```
