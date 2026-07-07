// Build: bundle src/ modules into the single self-contained Hypershelf.html.
// Includes the integrity checks that protect the single-file format:
//   1. no literal </script inside the inlined JS (terminates the script element silently)
//   2. the whole script parses (node --check)
//   3. the file ends with </html>
import fs from 'fs';
import { execSync } from 'child_process';

fs.mkdirSync('.build', { recursive: true });
execSync('npx -y esbuild src/main.js --bundle --format=iife --charset=utf8 --outfile=.build/bundle.js --log-level=warning', { stdio: 'inherit' });

let bundle = fs.readFileSync('.build/bundle.js', 'utf8');
// inline-script safety: '</'+'script' sequences inside strings must be escaped.
// (Safe globally: string values are unchanged ('\/'==='/'), and our regex
// literals already use the escaped form so they contain no raw match.)
bundle = bundle.replace(/<\/script/g, '<\\/script');

const shell = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/styles.css', 'utf8');
let out = shell
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>\n' + css + '</style>')
  .replace('<script type="module" src="./main.js"></script>', () => '<script>\n' + bundle + '</script>');

const start = out.indexOf('<script>') + 8;
const bEnd = out.indexOf('</script', start);
const gEnd = out.lastIndexOf('</script>');
if (bEnd !== gEnd) throw new Error('script boundary mismatch — literal </script leaked into the bundle');
if (!out.trimEnd().endsWith('</html>')) throw new Error('output does not end with </html>');
fs.writeFileSync('.build/check.js', out.slice(start, bEnd));
execSync('node --check .build/check.js', { stdio: 'inherit' });

fs.writeFileSync('Hypershelf.html', out);
console.log('Built Hypershelf.html —', out.length, 'bytes');
