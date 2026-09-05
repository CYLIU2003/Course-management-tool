# Campus Note：Google Cloud・Supabase・Cloudflare設定手順

2026-09-05確認。現在のGoogle OAuth＋初回セットアップ実装に対応する。

この文書は操作手順であり、外部サービスの設定や公開が完了したことを示すものではない。管理画面の項目名は、更新や表示言語によって多少異なる。

## 進める順序

1. Supabaseの本番・検証プロジェクトを作成する。
2. SQLと公式参照データを投入する。
3. Google Cloudとstaging Supabaseを接続する。
4. ローカルでGoogleログインを確認する。
5. Cloudflareに公開して本番URLを取得する。
6. 本番Google認証と管理者権限を設定する。
7. GitHub自動デプロイとPreviewを設定する。

## 1. 名前と環境を決める

| サービス | 本番 | 開発・検証 |
|---|---|---|
| Supabase Project | `campus-note-prod` | `campus-note-staging` |
| Google OAuth Client | `Campus Note Production` | `Campus Note Staging` |
| Cloudflare | mainの本番公開 | feature/*のPreview |

Google Cloudは1つのプロジェクトにOAuth Clientを2つ作る。Supabaseは本番と検証を別プロジェクトにする。

以下の`<prod-ref>`、`<staging-ref>`、`example.workers.dev`は説明用。実際の値に置き換える。

## 2. Supabaseプロジェクトを作成する

[Supabase Dashboard](https://supabase.com/dashboard)を開く。

1. ログインする。
2. **New project**を押す。
3. Organizationを選ぶ。
4. 下表の項目を入力する。
5. **Create new project**を押して準備完了を待つ。

| 項目 | 検証用の例 |
|---|---|
| Project name | `campus-note-staging` |
| Database Password | 生成した強いパスワードを保存 |
| Region | 利用者に近い日本・近隣リージョン |
| Plan | 作成画面で利用枠・料金を確認して選択 |

同じ操作で`campus-note-prod`を作成する。Database PasswordはCampus Noteのログイン用ではなく、データ投入用のDB認証情報。

各プロジェクトについて次を控える。Project URLはConnectやData API関連画面、Publishable keyはSettings → API Keysで確認する。

| 情報 | 例 | 使用場所 |
|---|---|---|
| Project URL | `https://<staging-ref>.supabase.co` | ローカル環境・Cloudflareビルド |
| Publishable key | `sb_publishable_...` | ローカル環境・Cloudflareビルド |
| Database Password | 作成時の値 | 運営端末からのDB接続 |

フロント用にはPublishable keyを使う。`sb_secret_...`や`service_role`キーを使わない。

公式資料：[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## 3. テーブル・RLS・RPCを作成する

まずstagingプロジェクトで作業する。

1. **SQL Editor**を開く。
2. **New query**を作る。
3. 以下の1番目のファイル全体を貼り付け、**Run**を押す。
4. 成功してから、2番目を別クエリで実行する。

```text
1. supabase/migrations/202609050001_campus_note.sql
2. supabase/migrations/202609050002_google_onboarding.sql
```

- [初回SQL](../supabase/migrations/202609050001_campus_note.sql)
- [Google認証対応SQL](../supabase/migrations/202609050002_google_onboarding.sql)

**初回SQLを適用済みなら2番目だけを追加する。適用済みSQLを繰り返し実行しない。** 今後は追加migrationをファイル名順に適用し、適用したファイル名を記録する。

SQL Editorで確認する。

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
```

`username`、`department_id`、`entrance_year`がNULL可で、`onboarding_completed`が存在すればGoogle用のプロフィール構造ができている。

同じ手順を本番プロジェクトでも実行する。RLSやRPCの権限はmigrationで設定されるので、エラー回避のためにRLSを無効化しない。

## 4. 公式参照データを投入する

Googleログインを試す前に参照データを入れる。初期設定の学科・年度一覧と入力検証に必要。

PowerShellで作業ディレクトリを開く。

```powershell
Set-Location C:\Course-management-tool
node --version
```

Nodeは`v22.23.2`を使う。次を順番に実行し、途中で失敗した場合は次へ進まず解消する。

```powershell
npm ci
python -m pip install -r requirements-ops.txt

npm run db:build
npm run db:offerings

python -m scripts.export_supabase
python -m scripts.import_supabase
```

最後のコマンドはファイル名・SHA・サイズ等の検査だけで、リモートDBを書き換えない。

staging Supabaseの**Connect**からPostgreSQL接続文字列を取得する。通常はDirect connectionを使い、IPv4のみのネットワークで接続できない場合は**Session pooler**を使う。今回の取込でTransaction poolerを使う必要はない。

```powershell
$env:SUPABASE_DB_URL = 'ここにstagingのPostgreSQL接続文字列'
python -m scripts.import_supabase --apply
Remove-Item Env:SUPABASE_DB_URL
```

接続文字列内のパスワードにはDatabase Passwordを使う。URL特殊文字を含むパスワードは、接続文字列内で適切にエンコードする。接続文字列をGitやVite変数へ保存しない。

取込後、SQL Editorで確認する。

```sql
select count(*) from public.reference_payloads;

select path
from public.reference_payloads
where path in (
  '/api/registration-options',
  '/api/offerings/2026'
);
```

2つ目のSELECTで2行表示されることを確認する。本番にも接続文字列を切り替えて同じデータを投入する。利用者アカウント・成績はこのexport対象に含まれない。

公式資料：[PostgreSQLへの接続方式](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 5. Google Cloudの基本設定

[Google Cloud Console](https://console.cloud.google.com/)を開く。

1. 上部のプロジェクト選択 → **新しいプロジェクト**。
2. 名前を`Campus Note`にして作成する。
3. 作成したプロジェクトを選択する。
4. 検索欄で**Google Auth Platform**を検索して開く。
5. 初回の**Get started／開始**が表示されたら進める。

Branding・Audience・連絡先を設定する。

| 項目 | 設定 |
|---|---|
| App name | `Campus Note` |
| User support email | 問い合わせを受けられるメール |
| Audience | 一般のGoogleアカウントを対象とする場合は`External` |
| Developer contact email | 管理用メール |

ホームページやプライバシーポリシーURLを求められた場合は、実際の公開ページを指定する。架空URLを入力しない。公開状態やブランド表示に応じた追加確認はGoogleの案内に従う。

**Data Access**のscopeは次の3つに限定する。

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Drive・Gmail・Calendarの権限は追加しない。

公式資料：[Supabase Google認証](https://supabase.com/docs/guides/auth/social-login/auth-google)、[Googleブランド確認](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## 6. Googleの検証用OAuth Client

Google Auth Platform → **Clients** → **Create client**を開く。

| 項目 | 設定 |
|---|---|
| Application type | `Web application` |
| Name | `Campus Note Staging` |
| Authorized JavaScript origins | `http://localhost:5173` |

次にstaging Supabaseを別タブで開く。

```text
Authentication
→ Sign In / Providers または Providers
→ Google
```

この画面の**Callback URL**をコピーし、Google Cloudの**Authorized redirect URIs**に貼り付ける。

通常の形：

```text
https://<staging-ref>.supabase.co/auth/v1/callback
```

| Google Cloudの入力欄 | 入れるもの |
|---|---|
| Authorized JavaScript origins | Campus Noteを開くorigin |
| Authorized redirect URIs | Supabaseのcallback URL |

作成後のClient IDとClient Secretを保存する。Secretは次の手順でSupabaseへ登録するだけで、Campus Noteのコードには入れない。

## 7. staging SupabaseのGoogle Providerと戻り先

Google Provider画面で有効化し、Staging ClientのIDとSecretを設定して保存する。

**Authentication → URL Configuration**を開く。

Site URL：

```text
http://localhost:5173
```

Redirect URLs：

```text
http://localhost:5173
http://localhost:5173/
```

現在のコードは`window.location.origin`を戻り先に使う。ブラウザーも`http://localhost:5173`で開く。`127.0.0.1`は別originなので、使う場合は別途登録が必要。

Googleだけを利用する場合はEmail Providerも無効化する。ただし既存メール利用者がいる場合は、Google経由で既存アカウントへ入れることを先に確認する。Google以外の新規認証経路や匿名ログインを今回有効にする必要はない。

公式資料：[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## 8. ローカルGoogleログイン試験

プロジェクト直下の`.env.local`へ次の4項目を設定する。

```dotenv
CAMPUS_PRODUCTION_SUPABASE_URL=https://<prod-ref>.supabase.co
CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY=sb_publishable_本番用
CAMPUS_STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co
CAMPUS_STAGING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_検証用
```

これらは例なので実値へ置き換える。現在のコードは両環境のURLが同じ場合に起動・ビルドを拒否する。

```powershell
npm run dev:supabase -- --host localhost --port 5173 --strictPort
```

5173番が使用中なら、既存の開発サーバーを停止してから実行する。`npm run dev`はローカルPython版の経路なので、Google認証試験には`dev:supabase`を使う。

確認項目：

- [ ] 「Googleでログイン」が表示される。
- [ ] Googleアカウントを選択してCampus Noteへ戻る。
- [ ] 初回だけユーザー名・学科・入学年度を入力する。
- [ ] 時間割を保存できる。
- [ ] 再ログインで初期設定が省略され、時間割が残る。
- [ ] 別のGoogleアカウントから他人のデータが見えない。

SupabaseのAuthentication → Usersで認証ユーザー、Table Editor → profilesで初期設定を確認できる。

## 9. Cloudflareへ最初の公開

[Cloudflare Dashboard](https://dash.cloudflare.com/)へログインできる状態にしてPowerShellで実行する。

```powershell
npx wrangler login
```

ブラウザーで対象Cloudflareアカウントを認証する。現在の`wrangler.jsonc`のWorker名は`campus-note`。

```powershell
npm run deploy:cloudflare
```

**このコマンドは実際に外部公開する。** 環境分離・Google認証コード・SQL/RLSのテスト、型検査、ビルド、assets検査を通過してから公開する。

成功時に表示される実URLを保存する。

```text
https://campus-note.<あなたのサブドメイン>.workers.dev
```

本番Google Providerが未設定の場合、この時点ではログインできない。次の手順まで完了してから利用者へ案内する。

## 10. 本番Google Clientと本番Supabase

Google Cloudに`Campus Note Production`というWeb applicationのOAuth Clientを作る。

| 項目 | 本番の設定 |
|---|---|
| Authorized JavaScript origins | 実際のCloudflare本番origin |
| Authorized redirect URIs | 本番Supabase画面からコピーしたcallback URL |

例：

```text
JavaScript origin:
https://campus-note.example.workers.dev

Redirect URI:
https://<prod-ref>.supabase.co/auth/v1/callback
```

Client ID/Secretを**本番Supabase**のGoogle Providerへ登録して有効化する。

本番SupabaseのSite URL：

```text
https://campus-note.example.workers.dev
```

本番SupabaseのRedirect URLs：

```text
https://campus-note.example.workers.dev
https://campus-note.example.workers.dev/
```

本番URLからログイン・初期設定・保存・再ログインを試験する。GoogleのAudienceがTestingの場合は、その画面のテスト対象と制限を確認する。必要に応じてTest usersへ試験アカウントを登録する。利用者へ広く案内する前にPublishing statusを確認し、要求される公開手続きを進める。

## 11. 管理者権限を付与する

本番Campus NoteにGoogleでログインし、初期設定を完了する。本番SupabaseのSQL Editorで自分を確認する。

```sql
select id, username, department_id, entrance_year, onboarding_completed
from public.profiles
where username = '自分が登録したユーザー名';
```

対象が正しいことを確認して実行する。

```sql
insert into public.admin_members(account_id)
select id
from public.profiles
where username = '自分が登録したユーザー名'
on conflict (account_id) do nothing;
```

Campus Noteを再読み込みすると「管理画面」が表示される。stagingとproductionのアカウント・管理権限は別々なので、それぞれ設定する。

問い合わせ送信 → 管理者回答 → 学生側で回答確認、まで試験する。

## 12. CloudflareとGitHubの自動デプロイ

最初の手動公開後、既存の`campus-note` WorkerにGitを接続する。

```text
Workers & Pages
→ campus-note
→ Settings
→ Build
→ Gitリポジトリを接続
```

画面が異なる場合はBuilds／Git integrationを探す。GitHubの対象リポジトリは`CYLIU2003/Course-management-tool`。

| 項目 | 設定 |
|---|---|
| Production branch | `main` |
| Root directory | リポジトリのルート |
| Build command | `npm run verify:cloudflare` |
| Production deploy command | `npx wrangler deploy` |
| Non-production deploy command | `npx wrangler versions upload` |
| 非本番の対象ブランチ | `feature/*` |
| Node | `22.23.2`（`.node-version`） |

**Build Variables and Secrets**へ次の4変数を登録する。

```text
CAMPUS_PRODUCTION_SUPABASE_URL
CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY
CAMPUS_STAGING_SUPABASE_URL
CAMPUS_STAGING_SUPABASE_PUBLISHABLE_KEY
```

値は`.env.local`と同じもの。登録先はRuntime Variablesではなくビルド用の変数。Cloudflareが渡す`WORKERS_CI_BRANCH`をコードが判別し、mainならproduction、feature/*ならstagingへ接続する。`WORKERS_CI_BRANCH`を手動で固定しない。

Cloudflareへ登録しないもの：Google Client Secret、SUPABASE_DB_URL、Database Password、Supabase secret/service_roleキー。

GitHub Actionsの有効化はこの構成に不要。Cloudflare側のGit連携を使う。

公式資料：[Builds設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Git連携](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)

## 13. PreviewでGoogleログインを使う

featureブランチをpushして表示されたPreview URLを確認する。Preview URLsが無効なら、対象Workerの設定から有効にする。

1. staging SupabaseのRedirect URLsに、実際のPreview originを追加する。
2. Google CloudのStaging ClientのJavaScript originsにも同じoriginを追加する。
3. GoogleのRedirect URIはstaging Supabaseのcallback URLのままにする。
4. Previewからログインし、stagingへ保存されることを確認する。

Preview URLが変わった場合は許可URLを更新する。最初は広いワイルドカードを使わず、試すURLを個別登録すると確認しやすい。

公式資料：[Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)

## 14. よくあるエラー

| 症状 | 確認先 |
|---|---|
| Google Providerのエラー | 接続先SupabaseのGoogle Providerが有効か |
| `redirect_uri_mismatch` | Google Clientに登録したSupabase callback URL |
| 認証後にlocalhostへ戻る | SupabaseのSite URL・Redirect URLs・現在開いているorigin |
| 初期設定の学科が出ない | reference_payloadsへのデータ投入 |
| 初期設定保存のSQLエラー | Google用の追加migrationが適用済みか |
| ユーザー名を保存できない | 重複、文字数、使用可能文字 |
| 管理画面が出ない | 対象DBのadmin_members.account_id |
| stagingが起動しない | CAMPUS_*の4変数と、本番・検証URLが別か |
| DB取込の接続エラー | 接続文字列、DBパスワード、Direct／Session pooler |
| Previewから本番データが見える | Build Logsの環境表示とBuild Variables |

## 15. 日常の更新

コード：featureブランチで確認 → mainへマージ → Cloudflare自動公開。

公式データ：db:build → db:offerings → export → import検査 → 対象DBを確認してimport --apply。

参照データだけの変更ならCloudflare再配信は不要。ただし公開PDFを変更・追加した場合はassetsの再デプロイが必要。

本番バックアップは別途Supabaseの契約・設定を確認して用意し、復元試験を行う。LocalStorageや参照データexportは、利用者データ・Auth全体のバックアップにはならない。

関連：[公開運用手順](deployment_cloudflare_supabase.md)、[Google認証の実装・検証記録](development_note_google_auth.md)
