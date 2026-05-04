const fs = require('fs');
let content = fs.readFileSync('c:/ProjectCode/contractmanager/web/src/App.tsx', 'utf8');

content = content.replace(/r\.verify\.includes\("오류"\)/g, '(r.verify || "").includes("오류")');
content = content.replace(/\{r\.verify\}/g, '{r.verify || "미검증"}');
content = content.replace(/compactVerify\(r\.verify\)/g, 'compactVerify(r.verify || "미검증")');

content = content.replace(/r\.status\.includes/g, '(r.status || "").includes');
content = content.replace(/statusClass\(r\.status\)/g, 'statusClass(r.status || "")');
content = content.replace(/compactStatus\(r\.status\)/g, 'compactStatus(r.status || "")');

fs.writeFileSync('c:/ProjectCode/contractmanager/web/src/App.tsx', content);
console.log('Fixed runtime errors!');
