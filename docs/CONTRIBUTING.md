# CONTRIBUTING

## ブランチ運用

- `main`: 安定運用
- `develop`: 開発統合
- `feature/*`: 個別タスク

### 開発フロー

```text
feature/* -> Pull Request -> develop -> 動作確認後 -> main
```

### 後輩向けルール

1. `develop` からブランチを切る。
2. 自分の担当ファイルに集中して変更する。
3. Pull Request を `develop` へ出す。
4. `main` には直接 push しない。

### ブランチ命名

```text
feature/機能名
fix/バグ修正
docs/文書
refactor/整理
data/データ作成
experiment/実験
```

## 基本ルール

1. `main` へ直接 push しない。
2. 1 PR 1 目的で小さく分ける。
3. UI 変更と core 大規模変更を同一 PR に混在させない。
4. 1タスク = 1ブランチを原則にする。

## 実装ルール

1. ドメインロジックは `src/core` を入口にする。
2. desktop/mobile は UI で分離し、ロジックは共有する。
3. 重要な型変更は Issue を先に作る。
