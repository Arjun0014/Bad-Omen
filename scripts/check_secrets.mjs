// Fails if any .env secret value appears in dist/ (never prints the values).
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } })('dist');
let leaks = 0;
for (const [k, v] of Object.entries(env)) {
  if (!v || v.length < 8 || /^[A-Za-z]:[\/]/.test(v)) continue; // skip short values and local paths
  for (const f of files) if (/\.(js|html|css|json|txt|map)$/.test(f) && fs.readFileSync(f, 'utf8').includes(v)) { console.error(`LEAK: ${k} found in ${f}`); leaks++; }
}
if (fs.existsSync('dist/.env')) { console.error('LEAK: dist/.env exists'); leaks++; }
console.log(leaks ? `${leaks} secret leak(s)!` : `OK: no .env values in ${files.length} dist files`);
process.exit(leaks ? 1 : 0);
