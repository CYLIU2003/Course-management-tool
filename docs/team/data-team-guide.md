# Data班 説明書

## 役割

Data班は、履修支援アプリで使うデータを作る担当です。

1. 科目データを整理する
2. 卒業要件データを整理する
3. サンプルデータを作る
4. 迷った点をメモする

## 作業ブランチ

`data/sample-curriculum`

```bash
git checkout develop
git pull origin develop
git checkout data/sample-curriculum
git pull origin data/sample-curriculum
```

ブランチが無い場合:

```bash
git fetch origin
git checkout data/sample-curriculum
```

## 作成ファイル

- `data/sample/courses.sample.json`
- `data/sample/requirements.sample.json`
- `data/sample/grades.sample.json`
- `docs/team/data-team-notes.md`

## 1. courses.sample.json

科目サンプルを10〜30件程度作る。

推奨項目:

- `id`
- `name`
- `credits`
- `category`
- `year` (任意)
- `term` (任意)
- `day` (任意)
- `period` (任意)

例:

```json
[
  {
    "id": "ee-001",
    "name": "電気回路",
    "credits": 2,
    "category": "専門必修",
    "year": 1,
    "term": "前期",
    "day": "月",
    "period": 2
  },
  {
    "id": "ee-002",
    "name": "電子回路",
    "credits": 2,
    "category": "専門選択",
    "year": 2,
    "term": "後期",
    "day": "火",
    "period": 3
  }
]
```

## 2. requirements.sample.json

卒業要件の区分と必要単位を定義する。

例:

```json
{
  "department": "電気電子通信工学科",
  "admissionYear": 2026,
  "requirements": [
    { "category": "専門必修", "requiredCredits": 30 },
    { "category": "専門選択必修", "requiredCredits": 10 },
    { "category": "専門選択", "requiredCredits": 40 },
    { "category": "教養", "requiredCredits": 20 }
  ]
}
```

## 3. grades.sample.json

GPA計算用の成績サンプル。

例:

```json
[
  { "courseId": "ee-001", "credits": 2, "grade": "A" },
  { "courseId": "ee-002", "credits": 2, "grade": "B" }
]
```

## 成績の意味 (初期)

- `S`: 4.0
- `A`: 3.0
- `B`: 2.0
- `C`: 1.0
- `D`: 0.0
- `F`: 0.0
- `未履修`: 計算対象外

## メモ運用

不明点は必ず `docs/team/data-team-notes.md` に記録する。

記録例:

- 科目区分が資料で曖昧
- 年度ごとの差分が未確認
- 曜日時限が未掲載

## ゴール

- `courses.sample.json` に10〜30科目
- `requirements.sample.json` の初期要件
- `grades.sample.json` の成績サンプル
- 迷いポイントのメモがある

## 禁止事項

- 不明分類を勝手に確定しない
- 推測で資料にない値を入れない
- JSONを壊したままにしない
- 形式を独断で変更しない
- `main` に直接pushしない

## コミット例

```bash
git add .
git commit -m "data: add sample course data"
git push origin data/sample-curriculum
```
