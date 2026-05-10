const fs = require('fs');

const path = 'src/components/requirements/RequirementCategoryDetailDrawer.tsx';
let txt = fs.readFileSync(path, 'utf8');

const match = /export default function [\s\S]*?return \(/;
txt = txt.replace(match, `export default function RequirementCategoryDetailDrawer({ categoryId, onClose, curriculum, courses, allYearsData, applicableCourses }: RequirementCategoryDetailDrawerProps) {
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

  return (`);

fs.writeFileSync(path, txt, 'utf8');
