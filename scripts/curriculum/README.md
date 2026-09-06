# Curriculum Source Processing

原本収集・抽出・座標照合・DB構築は[開発ノート](../../docs/development_note_curriculum.md#再収集と更新)を参照。ローカル版はSQLite API、公開版はSQLiteからexportしたSupabase参照データを使用する。フロントはCSVを読まない。

## 区分の再抽出

`verify_pdf_courses.py` による科目行の原本座標確認後に実行する。

```powershell
python scripts/curriculum/audit_classification.py
python scripts/curriculum/classify_pdf_courses.py
python scripts/curriculum/test_classification.py
npm.cmd run db:build
node scripts/audit-guide.mjs
python -m scripts.export_supabase
python -m scripts.import_supabase
```

分類結果は原本JSONにハッシュ・ページ・セル座標付きで保存。未知ラベルやセル対応不明は未解決とする。`docs/classification-coverage.json` と `docs/classification-cohorts.json` で資料別・学科年度別に確認する。必要単位の条件まで確認したものではない。

最後のimportは検査のみ。検証後、運営端末の `SUPABASE_DB_URL` で `python -m scripts.import_supabase --apply` を実行する。公開フロントの環境変数にはDB接続文字列を入れない。

2026年度開講情報は `npm.cmd run db:offerings` をexportより先に行う。教員・教場は `/api/offerings/2026` のDB payloadから参照する。旧 `public/department/rikou/` のCSV配置は現行アプリへ反映されない。
