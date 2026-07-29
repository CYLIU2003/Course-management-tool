export type UniversityProgramId = 'hirameki' | 'tap' | 'atap' | 'tucp';
export type TapCycle = 'A' | 'B';

export type UniversityProgramProfile = {
  selectedProgramIds: UniversityProgramId[];
  tapCycle: TapCycle;
  preparationAttendance?: number;
  preparationPassed: boolean;
  toeicScore?: number;
  ieltsScore?: number;
  toeflScore?: number;
};

export type UniversityProgramDefinition = {
  id: UniversityProgramId;
  name: string;
  shortName: string;
  category: 'curriculum' | 'study-abroad';
  summary: string;
  sourceUrl: string;
  sourceLabel: string;
  caution: string;
  conditions: string[];
};

export const UNIVERSITY_PROGRAM_PROFILE_STORAGE_KEY = 'academic_program_profile_v1';

export const UNIVERSITY_PROGRAMS: UniversityProgramDefinition[] = [
  {
    id: 'hirameki',
    name: 'ひらめき・こと・もの・くらし・ひとづくりプログラム',
    shortName: 'ひらめき',
    category: 'curriculum',
    summary: '所属学科の卒業要件と、分野横断型のプログラム科目を並行して管理します。',
    sourceUrl: 'https://hirameki.tcu.ac.jp/program/pdf/',
    sourceLabel: '公式リーフレット',
    caution: '修了判定は入学年度・学部・学科別リーフレットが正本です。この画面は科目名と履修実績の照合結果を表示します。',
    conditions: [
      '入学年度別リーフレットで指定された科目群を確認する',
      '所属学科の卒業要件124単位との算入関係を確認する',
      'TAP等を併用する場合は留学期間中の集中科目・3Q科目の重複を確認する',
    ],
  },
  {
    id: 'tap',
    name: '東京都市大学オーストラリアプログラム',
    shortName: 'TAP',
    category: 'study-abroad',
    summary: '準備教育と約4か月の豪州留学を組み合わせるプログラムです。',
    sourceUrl: 'https://tap.tcu.ac.jp/',
    sourceLabel: 'TAP公式サイト',
    caution: '留学時期と単位認定区分は学部・学科・サイクルで異なります。WebClassの募集要項・ハンドブックを最終確認してください。',
    conditions: [
      '入学時に登録する',
      '語学準備講座の出席率80%以上かつ成績が合格基準以上',
      '前期・後期の取得単位数がそれぞれ10単位以上',
    ],
  },
  {
    id: 'atap',
    name: 'Advanced TAP',
    shortName: 'ATAP',
    category: 'study-abroad',
    summary: '英語上級者向けにQUTのディプロマ科目を履修する留学プログラムです。',
    sourceUrl: 'https://tap.tcu.ac.jp/atap/',
    sourceLabel: 'ATAP公式サイト',
    caution: '4年間での卒業は保証されません。認定区分は学部により異なるため、履修計画を個別に確認してください。',
    conditions: [
      '参加年度前期のGPA 2.5以上',
      'IELTS 5.5以上（各サブスコア5.0以上）またはTOEFL iBT 56以上',
      '現地3科目を履修し、本学では原則1科目4単位・合計12単位として認定',
    ],
  },
  {
    id: 'tucp',
    name: '東京都市大学とカンタベリー大学との留学プログラム',
    shortName: 'TUCP',
    category: 'study-abroad',
    summary: 'カンタベリー大学で英語と正規開講科目を学ぶ上級者向けプログラムです。',
    sourceUrl: 'https://tsap1.tcu.ac.jp/tucp-home/',
    sourceLabel: 'TUCP公式サイト',
    caution: '開講科目・派遣時期・認定区分は年度と学部で変わるため、最新募集要項を確認してください。',
    conditions: [
      'TOEIC 600点以上',
      '約16週間の留学期間と国内履修の重複を確認する',
      '都市大での単位認定区分は学部ごとに確認する',
    ],
  },
];

export const HIRAMEKI_COURSE_GROUPS = [
  { id: 'hirameki', label: 'ひらめきづくり', keywords: ['ひらめきづくり'] },
  { id: 'koto', label: 'ことづくり', keywords: ['ことづくり'] },
  { id: 'mono', label: 'ものづくり', keywords: ['ものづくり'] },
  { id: 'kurashi', label: 'くらしづくり', keywords: ['くらしづくり'] },
  { id: 'hito', label: 'ひとづくり', keywords: ['ひとづくり'] },
  { id: 'next-pbl', label: 'Next PBL / SD PBL', keywords: ['nextpbl', 'sdpbl'] },
  { id: 'data-science', label: 'AI・データサイエンス', keywords: ['aiデータサイエンス', '人工知能', 'データサイエンス', '数理データ'] },
] as const;

export function createDefaultUniversityProgramProfile(): UniversityProgramProfile {
  return {
    selectedProgramIds: [],
    tapCycle: 'B',
    preparationPassed: false,
  };
}

export function loadUniversityProgramProfile(): UniversityProgramProfile {
  const defaults = createDefaultUniversityProgramProfile();

  try {
    const raw = localStorage.getItem(UNIVERSITY_PROGRAM_PROFILE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UniversityProgramProfile>;
    return {
      ...defaults,
      ...parsed,
      selectedProgramIds: (parsed.selectedProgramIds ?? []).filter((id): id is UniversityProgramId =>
        UNIVERSITY_PROGRAMS.some((program) => program.id === id),
      ),
      tapCycle: parsed.tapCycle === 'A' ? 'A' : 'B',
      preparationPassed: Boolean(parsed.preparationPassed),
    };
  } catch {
    return defaults;
  }
}

export function saveUniversityProgramProfile(profile: UniversityProgramProfile) {
  localStorage.setItem(UNIVERSITY_PROGRAM_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
