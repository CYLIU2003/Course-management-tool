import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type CreditRequirementRow = {
  stage: string;
  area: string;
  subarea: string;
  total_required_credits: number;
  必修_credits: number;
  選択必修1_credits: number;
  選択必修2_credits: number;
  自由_credits: number;
  notes: string;
};

type CourseRow = {
  id: string;
  title: string;
  credits: number;
  raw_required: string;
  category: string;
  group: string;
  courseType: 'required' | 'elective-required' | 'elective';
};

const creditRequirements: CreditRequirementRow[] = [
  { stage: '卒業', area: '共通分野', subarea: '教養科目', total_required_credits: 10, 必修_credits: 0, 選択必修1_credits: 0, 選択必修2_credits: 0, 自由_credits: 10, notes: '共通分野。卒業要件として10単位。' },
  { stage: '卒業', area: '共通分野', subarea: '体育科目', total_required_credits: 1, 必修_credits: 0, 選択必修1_credits: 1, 選択必修2_credits: 0, 自由_credits: 0, notes: '△選択必修科目1単位を含む。' },
  { stage: '卒業', area: '共通分野', subarea: '外国語科目', total_required_credits: 8, 必修_credits: 4, 選択必修1_credits: 0, 選択必修2_credits: 0, 自由_credits: 4, notes: '○必修科目4単位を含む。' },
  { stage: '卒業', area: '専門分野', subarea: '理工学基礎科目', total_required_credits: 31, 必修_credits: 17, 選択必修1_credits: 4, 選択必修2_credits: 2, 自由_credits: 8, notes: '○必修17単位、△1選択必修4単位、△2選択必修2単位を含む。' },
  { stage: '卒業', area: '専門分野', subarea: '専門科目', total_required_credits: 60, 必修_credits: 31, 選択必修1_credits: 0, 選択必修2_credits: 0, 自由_credits: 29, notes: '○必修31単位を含む。' },
  { stage: '卒業', area: '自由選択', subarea: '自由選択', total_required_credits: 14, 必修_credits: 0, 選択必修1_credits: 0, 選択必修2_credits: 0, 自由_credits: 14, notes: '他区分の余剰・特別履修等を算入。' },
];

const timetableRows: CourseRow[] = [
  { id: 'SE-111', title: '微分積分学(1a)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-112', title: '微分積分学(1b)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-211', title: '微分積分学(2a)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-212', title: '微分積分学(2b)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-113', title: '線形代数学(1a)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-114', title: '線形代数学(1b)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-213', title: '線形代数学(2a)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-214', title: '線形代数学(2b)', credits: 1, raw_required: '○ ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'required' },
  { id: 'SE-311', title: '微分方程式論', credits: 2, raw_required: '△1', category: '理工学基礎科目', group: '数学系', courseType: 'elective-required' },
  { id: 'SE-312', title: 'ベクトル解析学', credits: 2, raw_required: '△1', category: '理工学基礎科目', group: '数学系', courseType: 'elective-required' },
  { id: 'SE-313', title: 'フーリエ解析学', credits: 2, raw_required: '△1', category: '理工学基礎科目', group: '数学系', courseType: 'elective-required' },
  { id: 'SE-314', title: '数理統計学(a)', credits: 1, raw_required: '△1 ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'elective-required' },
  { id: 'SE-315', title: '数理統計学(b)', credits: 1, raw_required: '△1 ※MS', category: '理工学基礎科目', group: '数学系', courseType: 'elective-required' },
  { id: 'SE-123', title: '物理学実験(a)', credits: 1, raw_required: '○', category: '理工学基礎科目', group: '自然科学系', courseType: 'required' },
  { id: 'SE-124', title: '物理学実験(b)', credits: 1, raw_required: '○', category: '理工学基礎科目', group: '自然科学系', courseType: 'required' },
  { id: 'SE-131', title: '情報リテラシー演習(a)', credits: 1, raw_required: '○', category: '理工学基礎科目', group: '情報系', courseType: 'required' },
  { id: 'SE-132', title: '情報リテラシー演習(b)', credits: 1, raw_required: '○', category: '理工学基礎科目', group: '情報系', courseType: 'required' },
  { id: 'SE-241', title: '技術者倫理', credits: 2, raw_required: '○', category: '理工学基礎科目', group: '理工学教養系', courseType: 'required' },
  { id: 'MC-111', title: '機械設計製図(a)', credits: 1, raw_required: '○', category: '専門科目', group: '学科共通', courseType: 'required' },
  { id: 'MC-211', title: '機械設計製図(b)', credits: 1, raw_required: '○', category: '専門科目', group: '学科共通', courseType: 'required' },
  { id: 'MC-112', title: '機械工作実習(a)', credits: 1, raw_required: '○', category: '専門科目', group: '学科共通', courseType: 'required' },
  { id: 'MC-212', title: '機械工作実習(b)', credits: 1, raw_required: '○', category: '専門科目', group: '学科共通', courseType: 'required' },
  { id: 'MC-311', title: '創成設計演習', credits: 2, raw_required: '○', category: '専門科目', group: '学科共通', courseType: 'required' },
  { id: 'MC-221', title: '機械力学(1)及び演習・実験', credits: 3, raw_required: '○', category: '専門科目', group: '機械力学', courseType: 'required' },
  { id: 'MC-231', title: '材料力学', credits: 2, raw_required: '○', category: '専門科目', group: '材料力学', courseType: 'required' },
  { id: 'MC-241', title: '流れ学及び演習・実験', credits: 3, raw_required: '○', category: '専門科目', group: '流体力学', courseType: 'required' },
  { id: 'MC-251', title: '熱力学及び演習・実験', credits: 3, raw_required: '○', category: '専門科目', group: '熱力学', courseType: 'required' },
  { id: 'MC-261', title: '機械材料学及び演習・実験', credits: 3, raw_required: '○', category: '専門科目', group: '材料学', courseType: 'required' },
  { id: 'MC-271', title: '機械要素設計及び演習', credits: 3, raw_required: '○', category: '専門科目', group: '加工学', courseType: 'required' },
  { id: 'MC-312', title: '事例研究', credits: 2, raw_required: '○', category: '専門科目', group: '卒業研究関連', courseType: 'required' },
  { id: 'MC-411', title: '卒業研究(1)', credits: 3, raw_required: '○', category: '専門科目', group: '卒業研究関連', courseType: 'required' },
  { id: 'MC-412', title: '卒業研究(2)', credits: 3, raw_required: '○', category: '専門科目', group: '卒業研究関連', courseType: 'required' },
];

const generatedDir = join(process.cwd(), 'scripts', 'curriculum', 'generated');
mkdirSync(generatedDir, { recursive: true });

const creditCsv = [
  'stage,area,subarea,total_required_credits,必修_credits,選択必修1_credits,選択必修2_credits,自由_credits,notes',
  ...creditRequirements.map((row) => [row.stage, row.area, row.subarea, row.total_required_credits, row.必修_credits, row.選択必修1_credits, row.選択必修2_credits, row.自由_credits, row.notes].join(',')),
].join('\n');

const timetableCsv = [
  'id,title,credits,raw_required,category,group,courseType',
  ...timetableRows.map((row) => [row.id, row.title, row.credits, row.raw_required, row.category, row.group, row.courseType].join(',')),
].join('\n');

writeFileSync(join(generatedDir, 'kikai_credit_requirements.csv'), creditCsv, 'utf8');
writeFileSync(join(generatedDir, 'kikai_timetable_by_category.csv'), timetableCsv, 'utf8');

console.log('Generated kikai curriculum CSVs in', generatedDir);