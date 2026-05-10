const fs = require('fs');
let content = fs.readFileSync('patchReq.ts', 'utf8');
content = content.replace(/categoryName: .*?,/, "categoryName: area + ' - ' + subarea,");
fs.writeFileSync('C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/api/requirements.ts', content, 'utf8');
