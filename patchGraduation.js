const fs = require('fs');

// Update GraduationRequirementPanel.tsx
const grpPath = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/components/GraduationRequirementPanel.tsx';
let grpContent = fs.readFileSync(grpPath, 'utf8');

if (!grpContent.includes('applicableCourses')) {
  grpContent = grpContent.replace(
    /import \{ fetchRequirementCategories \} from '\.\.\/api\/requirements';/,
    \import { generateRequirementCategories, generateRequirementCategoryDetail } from '../api/requirements';
import type { ApplicableCourseRow } from '../utils/csvImporter';\
  );
  grpContent = grpContent.replace(
    /courses: AcademicCourse\[\];\n  currentYear\?: AcademicYear;\n\}/,
    \courses: AcademicCourse[];
  currentYear?: AcademicYear;
  applicableCourses?: ApplicableCourseRow[];
}\
  );
  grpContent = grpContent.replace(
    /export default function GraduationRequirementPanel\(\{ curriculum, allYearsData, courses, currentYear \}: GraduationRequirementPanelProps\) \{/,
    \xport default function GraduationRequirementPanel({ curriculum, allYearsData, courses, currentYear, applicableCourses }: GraduationRequirementPanelProps) {\
  );
  
  // Replace the effect that loads categories
  grpContent = grpContent.replace(
    /const nextCategories = await fetchRequirementCategories\(\);/g,
    \const nextCategories = generateRequirementCategories(curriculum, courses, allYearsData, applicableCourses || []);\
  );
  // remove the async/await and error handling since it's synchronous now
  grpContent = grpContent.replace(
    /async function loadCategories\(\) \{[\s\S]*?loadCategories\(\);/m,
    \unction loadCategories() {
      if (!curriculum) {
        setCategories([]);
        setLoadingCategories(false);
        return;
      }
      try {
        const nextCategories = generateRequirementCategories(curriculum, courses, allYearsData, applicableCourses || []);
        if (!cancelled) {
          setCategories(nextCategories);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCategoryError(loadError instanceof Error ? loadError.message : CATEGORY_LOAD_ERROR);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();\
  );
  grpContent = grpContent.replace(
    /fetchRequirementCategories\(\)\n\s*\.then\(\(nextCategories\) => \{\n\s*setCategories\(nextCategories\);\n\s*\}\)/,
    \	ry {
            const nextCategories = generateRequirementCategories(curriculum, courses, allYearsData, applicableCourses || []);
            setCategories(nextCategories);
          } catch(e: any) {
            setCategoryError(e.message);
          }\
  );

  // We also need to update RequirementCategoryDetailDrawer props and usage
  grpContent = grpContent.replace(
    /<RequirementCategoryDetailDrawer\n\s*open=\{openCategoryId !== null\}\n\s*categoryId=\{openCategoryId\}\n\s*onClose=\{\(\) => setOpenCategoryId\(null\)\}\n\s*\/>/,
    \<RequirementCategoryDetailDrawer
        open={openCategoryId !== null}
        categoryId={openCategoryId}
        onClose={() => setOpenCategoryId(null)}
        curriculum={curriculum}
        courses={courses}
        allYearsData={allYearsData}
        applicableCourses={applicableCourses}
      />\
  );
  
  fs.writeFileSync(grpPath, grpContent, 'utf8');
}

// Update RequirementCategoryDetailDrawer.tsx
const rcddPath = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/components/requirements/RequirementCategoryDetailDrawer.tsx';
let rcddContent = fs.readFileSync(rcddPath, 'utf8');
if (!rcddContent.includes('applicableCourses')) {
  rcddContent = rcddContent.replace(
    /import \{ fetchRequirementCategoryDetail \} from '\.\.\/\.\.\/api\/requirements';/,
    \import { generateRequirementCategoryDetail } from '../../api/requirements';
import type { ApplicableCourseRow } from '../../utils/csvImporter';
import type { AcademicCourse, AcademicAllYearsData, AcademicCurriculum } from '../../utils/academicProgress';\
  );
  rcddContent = rcddContent.replace(
    /type RequirementCategoryDetailDrawerProps = \{[\s\S]*?\};/,
    \	ype RequirementCategoryDetailDrawerProps = {
  open: boolean;
  categoryId: string | null;
  onClose: () => void;
  curriculum?: AcademicCurriculum;
  courses?: AcademicCourse[];
  allYearsData?: AcademicAllYearsData;
  applicableCourses?: ApplicableCourseRow[];
};\
  );
  rcddContent = rcddContent.replace(
    /export default function RequirementCategoryDetailDrawer\(\{ open, categoryId, onClose \}: RequirementCategoryDetailDrawerProps\) \{/,
    \xport default function RequirementCategoryDetailDrawer({ open, categoryId, onClose, curriculum, courses, allYearsData, applicableCourses }: RequirementCategoryDetailDrawerProps) {\
  );
  rcddContent = rcddContent.replace(
    /const detailData = await fetchRequirementCategoryDetail\(categoryId\);/,
    \if (!curriculum) throw new Error("カリキュラム未定義");
        const detailData = generateRequirementCategoryDetail(categoryId, curriculum, courses || [], allYearsData!, applicableCourses || []);\
  );
  fs.writeFileSync(rcddPath, rcddContent, 'utf8');
}
