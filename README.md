# 時間割管理アプリ (Course Management Tool)

東京都市大学の4クォーター制に対応した時間割・成績管理アプリです。

## 主な機能

### 📅 時間割管理
- 4クォーター(1Q-4Q)別の時間割作成
- 各科目の詳細情報(授業名、教場、担当教員、備考)の登録
- 色分けによる視覚的な管理
- 時間割のコピー機能(クォーター間)

### 📊 成績・単位管理
- **各科目の単位数登録**
- **成績登録** (秀・優・良・可・不可)
- **科目区分の設定** (必修・選択必修・選択)
- **学科別カリキュラムテンプレート**
  - 電気電子通信工学科
  - 機械工学科
  - 情報工学科
  - 建築学科
  - 都市工学科
  - 医用工学科
  - カスタム(自由設定)
- **GPA自動計算** (秀=4.0, 優=3.0, 良=2.0, 可=1.0, 不可=0.0)
- **取得単位数の自動計算**
- **残り必要単位数の表示**
- **科目区分別の進捗表示** (必修・選択必修・選択ごと)

### 📤 データ管理
- JSON形式でのエクスポート/インポート
- ICS形式でのカレンダー出力(Google Calendar等に対応)
- ローカルストレージによる自動保存

### 🖨️ 印刷機能
- A4横向きの印刷レイアウト最適化

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## 使い方

### 1. 学科・カリキュラムの設定
1. 設定ボタン(⚙️)をクリック
2. 「学科・カリキュラムテンプレート」で自分の学科を選択
3. 必要に応じて単位数を調整

### 2. 時間割の作成
- 各時間枠をクリックして授業情報を入力
- 授業名、教場、担当教員、色などを設定

### 3. 単位数と成績の登録
1. 授業編集画面で以下を入力:
   - **単位数**: 科目の単位数(例: 2)
   - **成績**: 秀・優・良・可・不可・未履修
   - **科目区分**: 必修・選択必修・選択

### 4. 進捗確認
- トップページの「📊 成績・単位情報」で確認
- 全体の取得単位数、残り単位数、GPA
- 科目区分別の詳細な進捗状況

## 技術スタック

- React 19
- TypeScript
- Vite
- CSS (カスタムプロパティ使用)

## 学科別カリキュラムテンプレート

アプリには以下の学科のカリキュラムテンプレートが組み込まれています:

| 学科 | 必修 | 選択必修 | 選択 | 合計 |
|------|------|----------|------|------|
| 電気電子通信工学科 | 88単位 | 20単位 | 16単位 | 124単位 |
| 機械工学科 | 90単位 | 18単位 | 16単位 | 124単位 |
| 情報工学科 | 85単位 | 22単位 | 17単位 | 124単位 |
| 建築学科 | 92単位 | 16単位 | 16単位 | 124単位 |
| 都市工学科 | 88単位 | 20単位 | 16単位 | 124単位 |
| 医用工学科 | 90単位 | 18単位 | 16単位 | 124単位 |

※ カスタム設定も可能です

## 開発・貢献

プルリクエストやイシューの報告を歓迎します!

## ライセンス

MIT

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
