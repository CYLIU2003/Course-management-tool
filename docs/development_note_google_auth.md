# Googleログインと初回セットアップ

2026-09-05。公開版の認証をGoogle OAuthへ変更。Python/SQLiteのローカル認証は維持する。実Google Cloud/Supabaseの設定・実ログイン・公開は未実施。

## 実装

- `supabase.auth.signInWithOAuth`でGoogle認証を開始する。戻り先は現在のoriginに固定し、要求scopeはopenid/email/profileのみ。
- 公開画面は「Googleでログイン」のみ。公開アダプターのメール登録・パスワードログイン経路は404。SupabaseのEmail Providerそのものは別途Dashboard設定が必要。
- 追加migration `202609050002_google_onboarding.sql`でプロフィール3項目をNULL許容とし、onboarding_completedを追加。既存の完全なプロフィールはtrueへ移行し、時間割や成績は変更しない。初回SQLは変更していない。
- 新規AuthユーザーのtriggerはIDだけを作成する。Googleメタデータの有無に依存せず、自己申告metadataによる管理者昇格や学科設定を採用しない。
- `/api/me`は未完了時にnullの学科等とonboardingCompleted=falseを返す。画面は初期設定を表示し、時間割をマウントしない。
- 初期設定APIは本人に限り、ユーザー名・学科・年度を検証して一括保存。ユーザー名は小文字で一意。重複時に入力を維持して再試行できる。完了後の再呼出しは409で上書きしない。
- 旧RPC本体を権限のない利用者から直接呼べない関数へ移し、公開RPCで初期設定を検証してから委譲する。未完了ユーザーは時間割・管理・問い合わせのRPCに進めない。

## Google Cloud / Supabaseの設定順序

1. まずstaging Supabaseへ全ての未適用migrationを順番に適用し、公式参照データを投入する。初期設定の選択肢と学科検証に必要。
2. Google CloudのGoogle Auth PlatformでBrandingとAudienceを設定。一般のGoogleアカウントを対象にする場合はExternal。Testing中は試験するアカウントをTest usersへ登録する。
3. Data Accessはopenid、email、profileのみ。Drive/Gmail/Calendarの権限は追加しない。
4. ClientsでWeb applicationのOAuth Clientを作成。Authorized JavaScript originsは`http://localhost:5173`等の実際のorigin。公開時はCloudflareの実originも登録する。
5. Authorized redirect URIsは**Supabase Google Provider画面に表示されたcallback URL**を登録する。通常は`https://<project-ref>.supabase.co/auth/v1/callback`。Campus NoteのURLと混同しない。
6. Client ID/SecretをSupabase Authentication → Providers → Googleへ登録して有効化。SecretはSupabaseにのみ保管し、GitやVite環境変数へ入れない。
7. SupabaseのSite URLとRedirect URLsに実際のアプリの戻り先を登録する。stagingはlocalhostと承認したpreview URL、productionは本番URLに分離する。
8. `npm run dev:supabase`で、Googleアカウント選択 → 初期設定 → 時間割 → 再ログインで初期設定省略、を確認する。別アカウントのデータ分離と問い合わせ／管理回答も確認する。
9. stagingで合格後にproductionへ同じ追加migrationと対応するGoogle Client設定を適用する。設定先を混同しない。`npm run verify:cloudflare`後に公開する。

既存のメールアカウントがある場合、Googleでログインした際に同じユーザーID・既存データへ紐付くことを試験する。異なるメールを使ったユーザー同士の自動統合は実装していない。Email Providerを止める前に、既存利用者のログイン経路を確認する。

公式参照: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)。Googleの認証設定は外部サービスのため、コードテストだけで有効化済みとは扱わない。

## Code Review Summary

Reviewer: Codex（自己レビュー）。P0未解決0件。P1はGoogle新規ユーザーのtrigger失敗、初期設定未完了のRPC利用、旧RPCによるガード迂回を修正。旧データを変更せず追加migrationで移行する構成を維持した。

検証: PGliteで旧プロフィール・保存データ・revisionの維持、Google形式のmetadataによる新規作成、metadata権限注入拒否、初期設定の必須化、未知学科拒否、ユーザー名重複、再設定拒否、旧RPC直接呼出し拒否を確認。既存のRLS・競合・管理・問い合わせ・プログラム8組合せテストも合格。

UI/SDK境界テストはGoogle専用表示、キャンセル時表示、初期設定項目、要求scopeと戻り先、メール経路拒否を確認する。これはReactの静的レンダリングとSDKのテスト代替による検証であり、実ブラウザーのGoogle認証完了を確認したものではない。実OAuth試験、Cloudflare公開、Claude Code・人間レビューは未実施。

最終確認: `npm run verify:cloudflare`（検証用URL）・対象TypeScriptのESLint・`git diff --check`が合格。assets 455件、最大9,433,717 bytes。通常ビルドへ戻し、検証用URLの成果物を残さない。JS約549 kBの既存サイズ警告は継続。
