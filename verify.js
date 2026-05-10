const fs = require('fs');

const path = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/utils/autoLoadCSV.ts';
let content = fs.readFileSync(path, 'utf8');

// The type errors in autoLoadCSV.ts are:
// 1. Line 124: missing in return for buildCSVPaths (if)
// 2. Line 135: missing in return for buildCSVPaths (else)
// Wait! I did replace buildCSVPaths but I replaced it with something that was probably reverted since I ran \git restore .\? Yes, I did \git restore .\ previously and that reverted autoLoadCSV.ts!
