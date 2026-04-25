# CONTRIBUTING

## ブランチ運用

- `main`: 安定運用
- `develop`: 開発統合 (導入予定)
- `feature/*`: 個別タスク

## 基本ルール

1. `main` へ直接 push しない。
2. 1 PR 1 目的で小さく分ける。
3. UI 変更と core 大規模変更を同一 PR に混在させない。

## 実装ルール

1. ドメインロジックは `src/core` を入口にする。
2. desktop/mobile は UI で分離し、ロジックは共有する。
3. 重要な型変更は Issue を先に作る。
