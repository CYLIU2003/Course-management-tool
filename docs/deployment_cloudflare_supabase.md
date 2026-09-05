# Cloudflare + Supabase 公開手順

2026-09-05。実装済み・未デプロイ。対象のCloudflareアカウント／WorkerとSupabaseプロジェクトが必要。

## 構成とデータ

- Cloudflare Workers Static AssetsがReact/Viteの`dist/`を配信する。
- 公開ビルドのAPIはSupabaseに統一。Authで本人確認、PostgreSQLでプロフィール・時間割・成績・設定・問い合わせを保存する。
- SQLiteはPDF抽出・出典照合とローカル開発用。公式データだけを227件のAPIスナップショットとしてPostgreSQLに移す。ローカルアカウント、パスワードハッシュ、成績はエクスポートしない。
- LocalStorageは利用者別の未同期キャッシュ。再接続時のrevision競合は自動上書きしない。初回認証・起動には接続が必要。

## 1. Supabase

対象プロジェクトのSQL Editor等で`supabase/migrations/202609050001_campus_note.sql`を一度適用する。新規スキーマ向けの初回マイグレーションで、既存テーブルへ重ねて実行しない。AuthのEmailを有効にし、Site URL／Redirect URLsを実際の公開URLに設定する。登録にはユーザー名、メール、12文字以上のパスワード、学科、入学年度を使う。メール確認を有効にする場合は、受信確認を本番テストに含める。

監査済みSQLiteから参照データを生成する:

```powershell
npm ci
python -m pip install -r requirements-ops.txt
npm run db:build
npm run db:offerings
python -m scripts.export_supabase
python -m scripts.import_supabase
```

最後のコマンドはファイル名、SHA-256、サイズ、重複経路を検証するだけ。運営端末の環境変数`SUPABASE_DB_URL`に対象プロジェクトのPostgreSQL接続文字列を設定した後、次を実行する:

```powershell
python -m scripts.import_supabase --apply
```

TLS接続で単一トランザクションに取込む。失敗時は全体をロールバックする。参照テーブルの旧スナップショット経路は削除するが、利用者データのテーブルには触れない。接続文字列やDBパスワードをGitや`VITE_`変数に入れない。

## 2. Cloudflare

`.env.example`にある次の公開設定をCloudflareのビルド環境へ設定する:

```text
CAMPUS_PRODUCTION_SUPABASE_URL=https://<prod-project-ref>.supabase.co
CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY=<prod-publishable-key>
CAMPUS_STAGING_SUPABASE_URL=https://<staging-project-ref>.supabase.co
CAMPUS_STAGING_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
```

`wrangler.jsonc`のWorker名を対象プロジェクトに合わせる。Git連携する場合は対象リポジトリ／公開ブランチを明示して選び、production branchを`main`、ビルドを`npm run verify:cloudflare`、本番デプロイを`npx wrangler deploy`、非本番デプロイを`npx wrangler versions upload`に設定する。非本番の対象は`feature/*`とする。GitHub Actionsは不要。Git連携そのものはまだ作成していない。

ローカルから公開するときはCloudflare認証済みの環境で`npm run deploy:cloudflare`。このコマンドは外部公開を行う。通常の`npm run build`はローカル版も生成できるため、公開時には必ず専用ビルドを使う。専用ビルドは設定欠落やservice-roleキーの混入を拒否する。

## 3. 管理者

公開アプリで自分のアカウントを登録・メール確認してから、運営用SQL接続でユーザー名を確認し、管理権限を付与する:

```sql
select id, username from public.profiles where username = '<登録したユーザー名>';
insert into public.admin_members(account_id)
select id from public.profiles where username = '<登録したユーザー名>'
on conflict (account_id) do nothing;
```

再読み込みするとヘッダーに「管理画面」が出る。最初の登録者を自動昇格させる機能や共通管理者パスワードはない。ローカル版は登録後に`python -m backend.grant_admin <username>`。ローカルのパスワード再設定は`python -m backend.reset_password <username>`。

## 4. 本番確認とバックアップ

公開後に、メール確認、ログイン、別端末の保存復元、同時編集の競合、他人データの拒否、一般ユーザーの管理API拒否、問い合わせと回答を確認する。現在の検証はローカルFlask、ブラウザー、PGliteのSQLであり、実Supabase/Cloudflareでの確認は未実施。

構成図のBackupは未設定。Supabaseの契約・設定を確認し、公式のDBバックアップ／復元手順に従って運営側で世代保存と復元テストを行う。ブラウザーJSONと公式データの再生成だけではAuthや問い合わせを復元できない。料金・自動課金設定の変更は行っていない。

参考: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。


## 公開前構成の固定（2026-09-05追記）

- Nodeは`.node-version`で22.23.2に固定。`package.json`のenginesは`>=22.12 <23`。Cloudflare側でもこのバージョンを使う。Python APIとSQLiteは本番に設置しない。
- `npm run dev`は従来のPython/SQLite経路。`npm run dev:supabase`はPythonを起動せずstagingへ接続する。`.env.example`を参考に`.env.local`へ2プロジェクトの公開設定を用意する。前者でSupabaseへ接続したくない場合は汎用`VITE_SUPABASE_*`を空にしておく。
- Cloudflare Buildsの`WORKERS_CI_BRANCH`が`main`ならproduction、`feature/*`ならstaging。他ブランチや環境矛盾は拒否する。2プロジェクトのURLが同じ場合も拒否する。ビルドスクリプトが選択した値だけを最終的な`VITE_SUPABASE_*`として埋め込む。
- 上の`CAMPUS_*`4変数はBuild Variablesに設定する。Runtime Variablesには設定しない。`SUPABASE_DB_URL`は運営端末限定で、Cloudflareには登録しない。
- ローカル本番ビルドは従来の`VITE_SUPABASE_*`2変数だけでも実行可能。ローカルstagingの成果物確認は`npm run build:cloudflare -- --target=staging`。
- `verify:cloudflare`は環境分離／秘密鍵拒否／assets上限テスト → 全migrationのRLS/RPCテスト → 型検査／公開ビルド → 20,000ファイル・1ファイル25 MiB以内の検査を行う。成功後だけ`deploy:cloudflare`が公開へ進む。
- 初回SQLは今後変更せず、日付順の追加migrationを作る。`test:supabase`は全SQLをファイル名順に実行する。新規プロジェクトも同じ順序で適用する。既存DBでは適用済みSQLを再実行せず、新規分のみ適用・履歴管理する。
- β版はメール確認OFFで即時登録する方針。未確認メールを本人確認済みとして扱わない。Auth側のパスワード最小長も12文字に設定する。パスワード復旧画面は未実装。本格運用のSMTP・メール確認ON・復旧画面は次段階。今回は実プロジェクトのAuth設定を変更していない。
- 更新順序は`db:build → db:offerings → export → import検査 → import --apply`。両DBにはそれぞれ接続先を確認して投入する。参照データだけならCloudflare再配信は不要。ただし公開PDFそのものを変更・追加した場合はassetsの再デプロイが必要。
- mainへのマージ、GitHub連携、2プロジェクトの作成・課金・実デプロイは未実施。無料枠が使えるかはアカウントの利用状況も含めて作成時に確認する。

仕様確認: [Cloudflare Buildsの変数とPreview](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Static Assets制限](https://developers.cloudflare.com/workers/platform/limits/)。
