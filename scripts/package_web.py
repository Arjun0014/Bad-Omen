# Package dist/ as an itch.io-ready HTML5 zip: index.html at the zip root, forward-slash entry names
# (Windows PowerShell's Compress-Archive can write backslash names that break on Linux hosts).
# Usage: npm run build && python scripts/package_web.py   ->  submission/bad-omen-web.zip
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
dist = root / 'dist'
out = root / 'submission' / 'bad-omen-web.zip'
if not (dist / 'index.html').is_file():
    sys.exit('dist/index.html missing: run `npm run build` first')
out.parent.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in dist.rglob('*') if p.is_file())
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in files:
        z.write(p, p.relative_to(dist).as_posix())
with zipfile.ZipFile(out) as z:
    names = z.namelist()
    bad = [n for n in names if '\\' in n or n.startswith('/')]
    if 'index.html' not in names or bad:
        sys.exit(f'bad zip layout: index.html at root={"index.html" in names}, bad names={bad[:3]}')
    if z.testzip() is not None:
        sys.exit('zip CRC check failed')
print(f'{out}  {len(names)} files  {out.stat().st_size / 1e6:.1f} MB  (index.html at the root)')
