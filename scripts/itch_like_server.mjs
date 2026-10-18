// A static server that behaves like itch.io's HTML5 CDN where a Windows file system doesn't: file names are
// case-sensitive, a path ending in "/" is refused (403) and nothing outside the game's folder exists. Run the browser
// tests through it to catch an asset referenced with the wrong case before itch.io does.
// Usage: node scripts/itch_like_server.mjs <extracted zip or dist> [port=4190]
//   then e.g.  node scripts/browser_smoke.mjs http://localhost:4190/html/12345/
//   and        curl http://localhost:4190/__report   (problems, and the files no test requested)
// The test scripts open the folder itself; itch.io's iframe opens .../index.html, which resolves the same way.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4190);
const BASE = '/html/12345/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
if (!fs.existsSync(path.join(root, 'index.html'))) { console.error(`no index.html in ${root}`); process.exit(1); }

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(root, p).split(path.sep).join('/')); } })(root);
const requested = new Set();
const problems = [];

/** Walk the path one segment at a time and require an exact-case directory entry at every level. */
function resolveExact(rel) {
  let dir = root;
  const segs = rel.split('/');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s || s === '.' || s === '..') return { problem: 'bad path segment' };
    let names;
    try { names = fs.readdirSync(dir); } catch { return { problem: 'missing' }; }
    if (!names.includes(s)) {
      const ci = names.find((n) => n.toLowerCase() === s.toLowerCase());
      return { problem: ci ? `WRONG CASE (on disk: ${segs.slice(0, i).concat(ci).join('/')})` : 'missing' };
    }
    dir = path.join(dir, s);
  }
  return fs.statSync(dir).isFile() ? { file: dir } : { problem: 'is a directory' };
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = url.pathname;
  try { p = decodeURIComponent(p); } catch { /* keep the raw path */ }
  if (p === '/__report') {
    const never = files.filter((f) => !requested.has(f));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ root, files: files.length, requested: requested.size, problems, neverRequested: never }, null, 1));
  }
  const fail = (code, problem) => {
    problems.push({ code, path: p, problem });
    console.log(`${code} ${p}  ${problem}`);
    res.writeHead(code, { 'content-type': 'text/plain' });
    res.end(`${code} ${problem}`);
  };
  if (!p.startsWith(BASE)) return fail(404, 'outside the game folder');
  let rel = p.slice(BASE.length);
  if (rel === '') rel = 'index.html';
  else if (rel.endsWith('/')) return fail(403, 'path ends in "/" (itch.io answers 403)');
  const r = resolveExact(rel);
  if (!r.file) return fail(404, r.problem);
  requested.add(rel);
  const data = fs.readFileSync(r.file);
  res.writeHead(200, { 'content-type': TYPES[path.extname(r.file).toLowerCase()] ?? 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-cache' });
  res.end(data);
}).listen(port, () => console.log(`itch-like (case-sensitive) server: ${root} (${files.length} files) at http://localhost:${port}${BASE}`));
