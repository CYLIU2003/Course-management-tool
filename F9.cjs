const fs = require('fs');

const path = 'src/components/requirements/RequirementCategoryDetailDrawer.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/import \{ fetchRequirementCategoryDetail \} from '\.\.\/\.\.\/api\/requirements';/, "import { generateRequirementCategoryDetail } from '../../api/requirements';\nimport type { AcademicCurriculum, AcademicCourse, AcademicAllYearsData } from '../../utils/academicProgress';\nimport type { ApplicableCourseRow } from '../../utils/csvImporter';");

txt = txt.replace(/interface RequirementCategoryDetailDrawerProps \{[\s\S]*?\}/, `interface RequirementCategoryDetailDrawerProps {
  categoryId: string | null;
  onClose: () => void;
  curriculum?: AcademicCurriculum;
  courses: AcademicCourse[];
  allYearsData: AcademicAllYearsData;
  applicableCourses: ApplicableCourseRow[];
}`);

txt = txt.replace(/export default function RequirementCategoryDetailDrawer[\s\S]*?const handleRetry = \(\) => \{\n    setReloadVersion\(\(v\) => v \+ 1\);\n  \};\n/g, `export default function RequirementCategoryDetailDrawer({ categoryId, onClose, curriculum, courses, allYearsData, applicableCourses }: RequirementCategoryDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<CategoryCourseTab>('candidate');

  const detail = useMemo(() => {
    if (!categoryId || !curriculum) return null;
    return generateRequirementCategoryDetail(categoryId, curriculum, courses, allYearsData, applicableCourses);
  }, [categoryId, curriculum, courses, allYearsData, applicableCourses]);

  const loading = false;
  const error = null;
  const open = !!categoryId;

  const handleClose = () => {
    onClose();
  };

  const handleRetry = () => {
  };
`);

fs.writeFileSync(path, txt, 'utf8');
