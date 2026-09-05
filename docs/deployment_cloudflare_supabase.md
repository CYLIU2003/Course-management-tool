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
python -m scripts.export_supabase
python -m scripts.import_supabase
python -m pip install -r supabase/requirements-import.txt
```

最後から2番目のコマンドはファイル名、SHA-256、サイズ、重複経路を検証するだけ。運営端末の環境変数`SUPABASE_DB_URL`に対象プロジェクトのPostgreSQL接続文字列を設定した後、次を実行する:

```powershell
python -m scripts.import_supabase --apply
```

TLS接続で単一トランザクションに取込む。失敗時は全体をロールバックする。参照テーブルの旧スナップショット経路は削除するが、利用者データのテーブルには触れない。接続文字列やDBパスワードをGitや`VITE_`変数に入れない。

## 2. Cloudflare

`.env.example`にある次の公開設定をCloudflareのビルド環境へ設定する:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

`wrangler.jsonc`のWorker名を対象プロジェクトに合わせる。Git連携する場合は対象リポジトリ／公開ブランチを明示して選び、ビルドを`npm run build:cloudflare`、デプロイを`npx wrangler deploy`に設定する。GitHub Actionsは不要。Git連携そのものはまだ作成していない。

ローカルから公開するときはCloudflare認証済みの環境で`npm run deploy:cloudflare`。このコマンドは外部公開を行う。通常の`npm run build`はローカル版も生成できるため、公開時には必ず専用ビルドを使う。専用ビルドは設定欠落やservice-roleキーの混入を拒否する。

## 3. 管理者

公開アプリで自分のアカウントを登録・メール確認してから、運営用SQL接続でユーザー名を確認し、管理権限を付与する:

```sql
select id, username from public.profiles where username = '<登録したユーザー名>';
insert into public.admin_members(id)
select id from public.profiles where username = '<登録したユーザー名>'
on conflict do nothing;
```

再読み込みするとヘッダーに「管理画面」が出る。最初の登録者を自動昇格させる機能や共通管理者パスワードはない。ローカル版は登録後に`python -m backend.grant_admin <username>`。ローカルのパスワード再設定は`python -m backend.reset_password <username>`。

## 4. 本番確認とバックアップ

公開後に、メール確認、ログイン、別端末の保存復元、同時編集の競合、他人データの拒否、一般ユーザーの管理API拒否、問い合わせと回答を確認する。現在の検証はローカルFlask、ブラウザー、PGliteのSQLであり、実Supabase/Cloudflareでの確認は未実施。

構成図のBackupは未設定。Supabaseの契約・設定を確認し、公式のDBバックアップ／復元手順に従って運営側で世代保存と復元テストを行う。ブラウザーJSONと公式データの再生成だけではAuthや問い合わせを復元できない。料金・自動課金設定の変更は行っていない。

参考: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
