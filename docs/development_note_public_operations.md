# 公開運用の整備（2026-09-05）

## 本番初回公開（2026-09-05）

以下は後述の初期検証記録以降に実施した本番作業。

- 公開URL: https://campus-note.a041139158715.workers.dev/
- Cloudflare Worker: `campus-note`。公開version: `c7a7ab38-b985-43d3-a481-aaa75884f2ca`。
- Supabase: `campus-note-prod` / `rnsqvyejfimzxwfkzfkf`。ローカルのGit対象外 `.env.local` に本番URLとpublishable keyを設定した。秘密鍵はフロントや文書に保存していない。
- 空だった `reference_payloads` に、ローカルmanifestのハッシュを検査した参照データ227件を投入。投入後、リモートの全path集合とローカルsnapshotが一致した。
- 今回は空テーブルであることを確認した初回のみ、管理用キーを一時的なプロセス環境で扱いREST経由で分割投入した。全件を単一トランザクションで投入したものではない。今後の更新は既存の `scripts.import_supabase --apply` によるPostgreSQLの原子的な更新を使う。
- 本番SQLで `profiles.onboarding_completed` と `campus_request_completed(text,text,jsonb)` の存在、および参照データ227件を確認した。
- Google Providerは既に有効で、有効なGoogle Client IDとSecretが設定済みだった。既存設定を利用し、Google同意画面の要求範囲は名前・プロフィール写真・メールのみであることを確認した。
- Supabase Site URLを公開originに変更し、Redirect URLsに同originと末尾 `/` 付きURLを追加した。既存localhost許可URLは維持した。
- `npm.cmd run deploy:cloudflare` が完了。環境検証3件、Google認証テスト、SQL/RLS/RPCテスト、公開build、assets上限検査を通過した。
- 公開サイトでGoogleログインを実行し、公開サイトの初期設定画面へ復帰、19学科の選択肢を表示した。個人プロフィールの入力値は本人確認待ちで、成績保存・複数端末同期・管理者回答の本番実機検証はまだ完了していない。
- stagingの作成、Git連携による自動デプロイ、Google OAuth Audienceの一般公開状態は、この初回公開作業では未確認。管理者付与もプロフィール確定後に行う。外部レビューは未実施。

## 初期の実装・検証記録

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
