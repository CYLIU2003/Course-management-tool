# Curriculum CSV Generation

このフォルダは、履修要覧PDFからCSVを生成するための補助スクリプト置き場です。

方針:
- PDFの直接取り込みはアプリ本体に入れない
- まず `scripts/curriculum/` でCSVを生成する
- 生成結果を人間が確認してから `public/department/rikou/` に配置する
- アプリ本体は既存のCSVローダーで読む

実運用では、PDFの版ごとに変換スクリプトを分け、生成物は `generated/` に出力します。