# アカウントと公開構成（2026-09-05）

## 実装・検証した機能

- 登録時のユーザー名（大小区別なし）・パスワード・学科・入学年度。
- SQLite v4への追加マイグレーション。時間割・成績・設定とプログラム選択をユーザーごとに分離。
- 同一画面の保存を直列化し、revisionで別画面の上書きを拒否。保存失敗時の再試行、未保存JSON退避、離脱警告。
- UUIDだけで誰でもアクセスできた旧 `/api/students/*` を廃止。 `/api/me/*` はセッション本人のみ。
- Argon2id、HttpOnly/SameSite Cookie、公開用Secure Cookie、セッション失効、CSRF/Origin/Host検証、試行回数・本文サイズ制限。
- ブラウザーの既存匿名LocalStorageは自動でアカウントへ混ぜない。既存JSONは検証・確認後に明示的インポート。

## Code Review Summary

Reviewer: Codex（自己レビュー）。対象: この作業の未コミット差分。

保存と認証の境界を分離し、ローカルの公式科目・要件はSQLiteから取得し、公開版はその監査済みスナップショットをSupabaseから取得する。UIだけでアクセスを制限せずAPI側で本人照合する。

- P0/MUST修正済み: 旧無認証UUID API、共有LocalStorageからの混入、競合上書き。
- P1修正済み: Flaskが不正Hostでもbefore_requestを実行するため、認証より先にHost拒否を適用。
- P2修正済み: 「この端末に保存」の古い表示、未検証JSONで画面を壊す読み込み処理。
- 自動テスト: アカウント10件、既存DB7件（95組のAPI確認を含む）、履修ロジック8件が合格。追加UIのESLintとViteビルド合格。
- ブラウザー: 新規登録、情報科学科2024年の反映、プログラミング(1)登録、優・1単位・GPA3.00の保存を確認。
- Claude Code/人間レビュー、外部CIは未実施。

## 公開構成の最新決定

ユーザーの追加指定により、公開先はCloudflare Workers Static Assets（React/Vite）＋Supabase（Auth/PostgreSQL/保存）へ変更する。Docker/Waitressでの外部公開は実施しない。ローカルのFlask/SQLite版は検証可能な開発経路として維持する。

提示された構成図を優先し、本番の参照データと利用者データはSupabase PostgreSQLとする。SQLiteは原本抽出・照合・ローカル開発の正本として維持する。Cloudflare/Supabaseの対象プロジェクトは未指定で、公開URLは未発行。デプロイ済みと扱わない。

Supabase版は標準のメール＋パスワード認証を採用した。登録時はユーザー名・メール・パスワード・入学学科・年度を入力する。メール追加は構成図から置いた実装上の前提。ローカル版はユーザー名でログインする。管理者権限は本人が更新できるプロフィールとは別に保管し、一般ユーザーによる昇格を禁止する。

参考: [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Flask Security](https://flask.palletsprojects.com/en/stable/web-security/)、[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。


## 同期・管理機能の追加とレビュー

- 利用者ID別のLocalStorageに未同期入力を退避し、サーバーのrevisionが一致する場合だけ再送する。競合は自動上書きせず、JSON退避／サーバー再読込を提示する。ログアウトで端末キャッシュを削除する。
- P1修正済み: 競合した下書きの基準revisionを保持する。別タブでログイン先が変わった場合は本人ID照合で読み書きを拒否する。JSONBのキー順変更による不要な更新は正規化比較で防止する。
- Supabase SQLはRLSと権限付きRPCで本人データを分離。プロフィールに管理者フラグを書いても昇格できない。管理者は運営のSQL／ローカルCLIで明示的に付与する。
- 管理画面に7/30/90日の利用人数・画面別集計・学科年度別人数と問い合わせ受信箱を追加。利用履歴に成績内容・パスワードを含めない。90日超過履歴の削除はイベント記録時に実行するため、厳密な期限削除には本番の定期ジョブが別途必要。
- 問い合わせは本人と管理者だけが参照・返信できる。アプリ内の対応窓口であり、大学への送信機能ではない。メッセージ順序はPostgreSQLの連番で安定化。
- 検証: Python 26件（認証10・管理4・既存DB7・開講原本照合5）が最終全件再実行で合格。履修ロジック8件、対象追加UI/APIのESLintも合格。
- PostgreSQL実マイグレーションをPGliteで実行し、RLS、権限注入拒否、他人の問い合わせ拒否、保存競合、管理回答、集計、プログラム8組合せを確認。
- ブラウザーでログイン後の保存復元、管理指標、テスト問い合わせと管理者回答、3,706講義の表示を確認。確認用アカウントとテスト問い合わせは検証後に削除。

## 残る境界

実Supabaseのメール配送・トークン検証・実プロジェクトRLSとCloudflare公開後の一連の動作は未検証。PGliteはAuthサービスの代替検証ではない。メールによるパスワード再設定画面、完全オフラインでの初回起動、アカウント削除画面は未実装。端末キャッシュはバックアップの代替ではない。運営の本番バックアップ／復元検証が必要。

[公開手順](deployment_cloudflare_supabase.md)に対象プロジェクトの設定、取込、管理権限付与をまとめた。Claude Code・担当者レビュー、外部CIは未実施で、Approveは出していない。

公開専用ビルドは検証用URL・公開キーを使ってコンパイルのみ合格。実接続はしていない。通常ビルドも合格。JS約545 kBのサイズ警告は残る。npm auditは依存更新後0件。
