const fs = require('fs');

const path = 'src/components/requirements/RequirementCategoryDetailDrawer.tsx';
let d = fs.readFileSync(path, 'utf8');

d = d.replace(/import \{ fetchRequirementCategoryDetail \} from '\.\.\/\.\.\/api\/requirements';/, "import { generateRequirementCategoryDetail } from '../../api/requirements';");
d = d.replace(/import type \{ AcademicCurriculum\, AcademicCourse\, AcademicAllYearsData \} from '\.\.\/\.\.\/utils\/academicProgress';\n/, "");
d = d.replace(/import type \{ ApplicableCourseRow \} from '\.\.\/\.\.\/utils\/csvImporter';\n/, "");

d = "import type { AcademicCurriculum, AcademicCourse, AcademicAllYearsData } from '../../utils/academicProgress';\nimport type { ApplicableCourseRow } from '../../utils/csvImporter';\n" + d;

d = d.replace(/interface RequirementCategoryDetailDrawerProps \{[\s\S]*?\}/, interface RequirementCategoryDetailDrawerProps {
  categoryId: string | null;
  onClose: () => void;
  curriculum?: AcademicCurriculum;
  courses: AcademicCourse[];
  allYearsData: AcademicAllYearsData;
  applicableCourses: ApplicableCourseRow[];
});

d = d.replace(/export default function RequirementCategoryDetailDrawer\([\s\S]*?\) \{[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}\, \[open\, categoryId\, reloadVersion\]\)\;/, xport default function RequirementCategoryDetailDrawer({ categoryId, onClose, curriculum, courses, allYearsData, applicableCourses }: RequirementCategoryDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<CategoryCourseTab>('candidate');

  const detail = useMemo(() => {
    if (!categoryId || !curriculum) return null;
    return generateRequirementCategoryDetail(categoryId, curriculum, courses, allYearsData, applicableCourses);
  }, [categoryId, curriculum, courses, allYearsData, applicableCourses]);

  const open = !!categoryId;);

d = d.replace(/const handleClose = \(\) => \{[\s\S]*?\}\;/, const handleClose = () => {
    onClose();
  };);
d = d.replace(/const handleRetry = \(\) => \{[\s\S]*?\}\;/, "");
fs.writeFileSync(path, d, 'utf8');
