# 公開運用の整備（2026-09-05）

対象: c2ff2bfからの作業差分。公開構成はReact/Vite → Supabase Auth/PostgreSQL/RLS/RPCのまま維持し、Python/SQLiteはデータ生成とローカル開発専用とした。

## 変更

- `.node-version`を22.23.2、Node enginesを`>=22.12 <23`に固定。
- `verify:cloudflare`を追加し、環境検査・SQLテスト・型検査・公開ビルド・assets上限確認後にのみ`deploy:cloudflare`が公開する。
- `dev:supabase`はstaging専用のVite起動。Python APIを起動しない。
- Cloudflareの`WORKERS_CI_BRANCH`からmainはproduction、feature/*はstagingへ振り分ける。CIでは汎用VITE設定へのフォールバックを禁止し、両プロジェクトのURLが同じ場合も停止する。明示された環境とブランチが矛盾すると停止する。
- 管理者付与SQLの列名を`account_id`へ修正。テストでも同じINSERT SELECTとON CONFLICTの形を実行する。
- 初回migrationは変更していない。テストは追加SQLも含めてファイル名順に実行する。
- `requirements-ops.txt`でローカル運営依存をまとめ、`db:build → db:offerings → export → import検査 → import --apply`を公開手順に記載。
- β版のメール確認OFF方針と、SMTP・復旧画面を次段階とする運用を記載。実サービスの設定変更はしていない。

## Code Review Summary

Reviewer: Codex（自己レビュー）。外部レビュー／CI／実クラウドの検証は未実施。

既存APIを維持したまま、公開時の環境選択と検証を共通関数へ分離した。管理者権限は従来どおりSQL/RPC側で制限される。

- P0: 今回の差分で未解決の指摘0件。
- P1: 管理者SQLの誤列名、プレビューで汎用本番設定を継承する問題を修正。
- P2: assets上限検査と全migrationのテスト対象化を追加。
- P3: 新規指摘0件。
- 良い点: initial SQLを維持し、実行順序と環境境界をテストで検証できる。

## 検証結果と限界

- Node 22.23.2で環境分離／不正URL・秘密鍵拒否／assets境界の3テスト合格。
- PGliteで全migration、RLS、RPC、管理者付与、問い合わせ、競合、プログラム8組合せのテスト合格。
- `verify:cloudflare`が検証用production設定で合格。feature/*設定のstagingビルドも合格。
- staging成果物にstaging URLが含まれ、production URLが含まれないことを確認。
- assetsは455ファイル。最大は`handbooks/hirameki/2022/for_student.pdf`、9,433,717 bytes。20,000ファイル・25 MiB/ファイルのゲートを通過。
- 通常のローカルビルドへ戻し、検証用URLを使ったdistを最終成果物として残さない。
- 既存のJS約545 kBのVite警告は継続。public資料移動やパスワード復旧の実装は今回の対象外。

接続値はテスト用で、Authメール配送や実Supabaseへの保存を検証したものではない。2プロジェクトの作成、CloudflareのBuild Variables設定、mainへのマージ、Git連携、実公開、バックアップ設定はまだ実施していない。実プロジェクト設定後のA/B/管理者アカウント確認を公開手順の最終検証として残す。
