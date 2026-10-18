"""Builds submission/bad-omen-source-code.docx: the game's source code as a Word document (the jam form's "Source Code"
field takes a document file, max 100 MB). Standard library only: the WordprocessingML is written by hand.

usage: python scripts/make_source_docx.py
"""
import datetime
import glob
import os
import re
import subprocess
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'submission', 'bad-omen-source-code.docx')


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True).stdout.strip()


# the game itself, its build setup, and the Blender pipeline that recoloured Komur and made his animations
files = ['index.html', 'package.json', 'vite.config.js']
files += sorted(rel(p) for p in glob.glob(os.path.join(ROOT, 'src', '**', '*'), recursive=True)
                if os.path.isfile(p) and p.endswith(('.js', '.css', '.json', '.html')))
files += ['tools/blender/build_komur.py', 'tools/blender/komur_actions.py', 'tools/blender/build_grandma.py',
          'scripts/package_web.py']
for f in files:
    assert os.path.isfile(os.path.join(ROOT, f)), f

BAD = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f]')


def t(text):
    return escape(BAD.sub('', text))


def para(text, style=None, bold=False):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    if not text:
        return f'<w:p>{ppr}</w:p>'
    rpr = '<w:rPr><w:b/></w:rPr>' if bold else ''
    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{t(text)}</w:t></w:r></w:p>'


tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*-jam')
commit = git('rev-list', '-n', '1', tag)[:7] if tag else git('rev-parse', '--short', 'HEAD')
body = []
body.append(para('BAD OMEN — Source Code', 'Title'))
body.append(para('Game Jam Europe 2026 · team Fractured Sanity · Arjun Vinod', 'Subtitle'))
body.append(para(f'Release {tag} (commit {commit}): the build submitted on itch.io. '
                 f'Generated {datetime.date.today().isoformat()} from the project repository.'))
body.append(para('About', 'Heading1'))
body.append(para('BAD OMEN is a third-person physics comedy that runs in the browser. You play Kömür, a black cat (white paws, '
                 'chest and tail tip, amber eyes) in a superstitious witch-grandma’s two-storey cottage. Grandma blames the '
                 'black cat for her bad luck, but every big disaster is thrown by her own hand: Kömür baits her throws into '
                 'the house’s weak points. Built with three.js (WebGL2), the Rapier physics engine (WASM) and Vite; the '
                 'characters and Kömür’s animations come from a headless Blender pipeline (tools/blender).'))
body.append(para('How to run', 'Heading1'))
for line in ['Requires Node 22+ and a WebGL2 browser (Chrome, Edge or Firefox).',
             'npm install',
             'npm run dev        → http://localhost:5173 (click Play)',
             'npm run build      → dist/ (static files; index.html opens through any web server)',
             'npm run package    → submission/bad-omen-web.zip (the itch.io HTML5 upload)',
             'npm test           → unit tests (scoring, combos, rage, finale gating)']:
    body.append(para(line, 'Code'))
body.append(para('The models, textures, voices, music and sound effects live in public/ in the repository and are not '
                 'reproduced here (binary files). Credits and licences: CREDITS.md and the in-game Credits screen.'))
body.append(para('Code map', 'Heading1'))
groups = [('src/main.js, src/game/', 'the game loop, the director (tutorial, quests, dialogue cues), set pieces, scoring rules, achievements, cutscene sequences'),
          ('src/player/Cat.js', 'Kömür: the character controller (Rapier kinematic), gaits, leaps, pounce, swipe, taunt, hide, scratch, idle life, procedural spine/tail/head layer'),
          ('src/ai/', 'Grandma: sight and hearing, A* waypoint navigation over both floors, chase, telegraphed throws, catches and the hold; thrown projectiles'),
          ('src/world/', 'the procedural cottage, ~375 breakable props, fracture and persistent debris, fire, materials, the light pool'),
          ('src/audio/, src/fx/, src/camera/, src/core/, src/ui/', 'music director, sound, effects, follow camera, input (keyboard, mouse, touch), physics wrapper, HUD and menus'),
          ('tools/blender/', 'headless Blender scripts: Kömür’s recolour and 38 procedural animations, Grandma’s Mixamo merge, GLB export')]
for a, b in groups:
    body.append(f'<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{t(a)}: </w:t></w:r>'
                f'<w:r><w:t xml:space="preserve">{t(b)}</w:t></w:r></w:p>')
body.append(para('Files', 'Heading1'))
total = 0
counts = []
for f in files:
    with open(os.path.join(ROOT, f), encoding='utf-8') as fh:
        n = fh.read().count('\n') + 1
    counts.append(n)
    total += n
for f, n in zip(files, counts):
    body.append(para(f'{f}  ({n} lines)', 'Code'))
body.append(para(f'{len(files)} files, {total:,} lines.'))
for f in files:
    body.append(para(f, 'Heading2'))
    with open(os.path.join(ROOT, f), encoding='utf-8') as fh:
        for line in fh.read().splitlines():
            body.append(para(line.replace('\t', '    '), 'Code'))

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="{W}"><w:body>'
            + ''.join(body)
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="851" w:right="794" w:bottom="851" w:left="794" '
              'w:header="397" w:footer="397" w:gutter="0"/></w:sectPr></w:body></w:document>')


def style(sid, name, ppr='', rpr='', based='Normal', kind='paragraph'):
    b = f'<w:basedOn w:val="{based}"/>' if based else ''
    return (f'<w:style w:type="{kind}" w:styleId="{sid}"><w:name w:val="{name}"/>{b}<w:qFormat/>'
            f'<w:pPr>{ppr}</w:pPr><w:rPr>{rpr}</w:rPr></w:style>')


font = lambda f: f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}" w:eastAsia="{f}"/>'
styles = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="{W}">'
          f'<w:docDefaults><w:rPrDefault><w:rPr>{font("Calibri")}<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>'
          '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
          + style('Normal', 'Normal', based=None)
          + style('Title', 'Title', '<w:spacing w:after="60"/>', f'{font("Calibri Light")}<w:b/><w:color w:val="1A1324"/><w:sz w:val="52"/><w:szCs w:val="52"/>')
          + style('Subtitle', 'Subtitle', '<w:spacing w:after="240"/>', '<w:color w:val="9A6A00"/><w:sz w:val="26"/><w:szCs w:val="26"/>')
          + style('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="5B3A8C"/><w:sz w:val="30"/><w:szCs w:val="30"/>')
          + style('Heading2', 'heading 2', '<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="C9B8E6"/></w:pBdr><w:spacing w:before="320" w:after="80"/><w:outlineLvl w:val="1"/>', f'{font("Consolas")}<w:b/><w:color w:val="5B3A8C"/><w:sz w:val="22"/><w:szCs w:val="22"/>')
          + style('Code', 'Code', '<w:spacing w:after="0" w:line="216" w:lineRule="auto"/>', f'{font("Consolas")}<w:sz w:val="15"/><w:szCs w:val="15"/>')
          + style('ListBullet', 'List Bullet', '<w:spacing w:after="60"/><w:ind w:left="360" w:hanging="200"/>', '')
          + '</w:styles>')

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>BAD OMEN — Source Code</dc:title><dc:creator>Fractured Sanity (Arjun Vinod)</dc:creator>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        '</cp:coreProperties>')
app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
       '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BAD OMEN source export</Application></Properties>')
content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                 '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
                 '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
                 '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
                 '</Types>')
R = 'http://schemas.openxmlformats.org/package/2006/relationships'
rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{R}">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>')
doc_rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{R}">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>')

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', document)
    z.writestr('word/_rels/document.xml.rels', doc_rels)
    z.writestr('word/styles.xml', styles)
    z.writestr('docProps/core.xml', core)
    z.writestr('docProps/app.xml', app)
print(f'{OUT}: {len(files)} files, {total:,} lines, {os.path.getsize(OUT) / 1e6:.2f} MB ({tag}, {commit})')
