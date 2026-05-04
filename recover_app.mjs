import fs from 'node:fs';

const logPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\84aa18b3-6407-4f88-b771-042099169706\\.system_generated\\logs\\overview.txt';
const logLines = fs.readFileSync(logPath, 'utf8').split('\n');

let appContent1 = '';
let appContent2 = '';

for (const line of logLines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'TOOL_CALL_RESULT' && obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'view_file' && call.output && call.output.includes('App.tsx')) {
          if (call.output.includes('Showing lines 1 to 800')) {
            appContent1 = call.output;
          } else if (call.output.includes('Showing lines 800 to 1567') || call.output.includes('Showing lines 800 to ')) {
            appContent2 = call.output;
          } else if (call.output.includes('Showing lines 1 to 156')) {
             appContent1 = call.output; // In case it read the whole thing
          }
        }
      }
    }
  } catch(e) {}
}

function extractCode(output) {
  const match = output.match(/The following code has been modified to include a line number before every line[\s\S]*?\n((?:\d+: [^\n]*\n?)+)/);
  if (!match) return '';
  const linesBlock = match[1];
  return linesBlock.split('\n')
    .map(line => {
      const idx = line.indexOf(': ');
      if (idx !== -1 && /^\\d+$/.test(line.slice(0, idx))) {
        return line.slice(idx + 2);
      }
      return line;
    })
    .filter(line => !line.startsWith('The above content does NOT show') && !line.startsWith('The above content shows the entire'))
    .join('\n');
}

let finalCode = '';
if (appContent1 && appContent2) {
  finalCode = extractCode(appContent1) + '\n' + extractCode(appContent2);
  console.log('Recovered from two parts');
} else if (appContent1) {
  finalCode = extractCode(appContent1);
  console.log('Recovered from one part');
}

if (finalCode) {
  // Strip duplicate lines around line 800 if they overlap, but view_file start/end are exact.
  // We'll just write it.
  fs.writeFileSync('C:\\ProjectCode\\contractmanager\\web\\src\\App.tsx', finalCode);
  console.log('Wrote recovered App.tsx!');
} else {
  console.log('Failed to find the content in logs.');
}
