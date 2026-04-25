# TASK_TEMPLATE

## タスク名

`[mobile] CourseCard を実装する`

## 目的

スマホ画面で科目情報をカードとして読みやすく表示する。

## 対象ファイル

- `src/components/mobile/CourseCard.tsx`

## 入力 props

```ts
type CourseCardProps = {
  course: Course;
  selected?: boolean;
  onSelect?: (courseId: string) => void;
};
```

## 禁止事項

1. GPA 計算を UI 内に実装しない。
2. 卒業判定を UI 内に実装しない。
3. 型を独自変更しない。

## 完了条件

1. 型エラーがない。
2. `npm run build` が通る。
3. 指定 UI 要件を満たす。
