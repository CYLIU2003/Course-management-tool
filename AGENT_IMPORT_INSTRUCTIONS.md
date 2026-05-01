# Agent Import Instructions - TCU 2026 Curriculum Complete Seed

## Goal
Import 2026年度入学向けの全学部・全学科履修データ into `CYLIU2003/Course-management-tool`.

## Copy data files
Copy the following directory from this package into the repository root:

```bash
cp -R public/department ./public/
```

This adds:

```text
public/department/_catalog/
public/department/rikou/2026/
public/department/kenchiku_toshi/2026/
public/department/joho/2026/
public/department/kankyo/2026/
public/department/media_joho/2026/
public/department/design_data/2026/
public/department/toshi_seikatsu/2026/
public/department/ningen/2026/
public/department/teacher/2026/
```

## Update loader
The current loader assumes `/department/rikou`. Apply the logic in:

```text
src/utils/autoLoadCSV.2026.complete_patch.ts
```

Required changes:

1. Add `facultyId` to the department definition.
2. Replace fixed `const basePath = /department/rikou` with `const basePath = /department/${department.facultyId}`.
3. Use `AVAILABLE_DEPARTMENTS_2026` as the source for selectable departments.
4. Keep old `/department/rikou/*.csv` fallback only for existing 理工学部 data.

## Validation
After import, run the app and check that these 19 department IDs can load with entranceYear=2026:

```text
kikai, kikai_system, denki, iyo, ouyou_kagaku, genshiryoku, shizen_shizen, shizen_suuri,
kenchiku, toshi_kogaku,
joho_kagaku, chino_joho,
kankyo_sosei, kankyo_keiei,
shakai_media, joho_system,
design_data,
toshi_seikatsu,
ningen
```

## Known schema limitation
`credit_requirements.csv` is a flat summary. Course/track-specific conditions that are not representable in the current schema are stored in:

```text
public/department/_catalog/rules_2026.json
```

Do not discard this file. Use it for future graduation-risk logic.
