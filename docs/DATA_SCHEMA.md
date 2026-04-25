# DATA_SCHEMA

## Core 型 (最優先)

- `Course`
- `Requirement`
- `GradeRecord`
- `TimetableSlot`
- `GraduationCheckResult`

## 現在の実装対応

既存型は `src/utils/academicProgress.ts` にあり、`src/core/types.ts` から再公開する。

## 変更ルール

1. 主要型の変更は Issue 化する。
2. 互換性を壊す変更は PR で明示する。
3. UI 実装側で型の独自再定義を禁止する。
