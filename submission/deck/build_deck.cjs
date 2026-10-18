// BAD OMEN pitch deck (5 slides): one slide description, two renderers.
//   -> bad-omen-pitch.pptx  (pptxgenjs, themed, sections, a layout per slide frame)
//   -> preview/slide-N.png + bad-omen-pitch.pdf (same layout as HTML in headless Edge: QA + a PDF copy)
// Run from the repo root:  NODE_PATH=<dir with pptxgenjs>/node_modules node submission/deck/build_deck.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pptxgen = require('pptxgenjs');

const DIR = __dirname;
const IMG = (n) => path.join(DIR, 'img', n);
const SW = 13.333, SH = 7.5; // LAYOUT_WIDE, inches

// ------------------------------------------------------------------ palette / theme (the game's own colours)
const PAL = { ink: '0D0A14', bone: 'F3E6C8', plum: '1E1428', muted: 'B9A98A', amber: 'FFAE1A', green: '7DFF7A', red: 'FF5A3A', violet: 'B26BFF', deep: '2A1E38', purple: '6A3A8A' };
const THEME = {
  name: 'Bad Omen', headFontFace: 'Cambria', bodyFontFace: 'Calibri',
  colors: { dk1: PAL.ink, lt1: PAL.bone, dk2: PAL.plum, lt2: PAL.muted, accent1: PAL.amber, accent2: PAL.green, accent3: PAL.red, accent4: PAL.violet, accent5: PAL.deep, accent6: PAL.purple, hlink: PAL.amber, folHlink: PAL.violet },
};

// ------------------------------------------------------------------ logo (Creepster, the game's title font)
function makeLogo() {
  const f = path.resolve(DIR, '../../src/assets/fonts/Creepster-Regular.ttf').replace(/\\/g, '/').replace(':', '\\:');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1800x420,format=rgba', '-vf',
    `drawtext=fontfile='${f}':text='BAD OMEN':fontsize=330:fontcolor=0xffae1a:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.85:shadowx=0:shadowy=10`,
    '-frames:v', '1', IMG('logo.png')], { stdio: 'inherit' });
}

// ------------------------------------------------------------------ slide content
// element: {t:'img'|'rect'|'oval'|'text', x,y,w,h (inches), ...}. Text sizes in pt; colours are palette keys.
const step = (n, x, y, head, body) => [
  { t: 'oval', x, y: y + 0.04, w: 0.56, h: 0.56, fill: 'amber' },
  { t: 'text', x, y: y + 0.04, w: 0.56, h: 0.56, text: String(n), size: 20, bold: true, color: 'ink', align: 'center', valign: 'middle', font: 'head', margin: 0 },
  { t: 'text', x: x + 0.78, y, w: 4.6, h: 0.42, text: head, size: 18, bold: true, color: 'amber', font: 'head', margin: 0 },
  { t: 'text', x: x + 0.78, y: y + 0.42, w: 4.6, h: 0.62, text: body, size: 14, color: 'bone', margin: 0 },
];
const stat = (x, y, num, label) => [
  { t: 'rect', x, y, w: 1.85, h: 1.35, fill: 'plum', radius: 0.12 },
  { t: 'text', x, y: y + 0.12, w: 1.85, h: 0.72, text: num, size: 40, bold: true, color: 'amber', align: 'center', valign: 'middle', font: 'head', margin: 0 },
  { t: 'text', x, y: y + 0.84, w: 1.85, h: 0.38, text: label, size: 12, color: 'muted', align: 'center', valign: 'top', margin: 0 },
];
const card = (x, y, w, h, head, body) => [
  { t: 'rect', x, y, w, h, fill: 'plum', radius: 0.12 },
  { t: 'text', x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.4, text: head, size: 16, bold: true, color: 'amber', font: 'head', margin: 0 },
  { t: 'text', x: x + 0.22, y: y + 0.58, w: w - 0.44, h: h - 0.72, text: body, size: 13, color: 'bone', margin: 0 },
];

const SLIDES = [
  { layout: 'BO_TITLE', section: 'Bad Omen', notes: 'Hook: a black cat who makes a superstitious Grandma wreck her own house.', els: [
    { t: 'img', path: IMG('portrait.jpg'), x: 0, y: 0, w: SW, h: SH },
    { t: 'rect', x: 0, y: 0, w: 7.1, h: SH, fill: 'ink', transparency: 18 },
    { t: 'img', path: IMG('logo.png'), x: 0.55, y: 1.25, w: 6.2, h: 6.2 * 420 / 1800 },
    { t: 'text', x: 0.62, y: 2.85, w: 6.2, h: 0.5, text: 'ONE CAT. TWO FLOORS. NO DEPOSIT REFUNDS.', size: 18, color: 'bone', charSpacing: 2, margin: 0 },
    { t: 'text', x: 0.62, y: 3.55, w: 6.0, h: 1.2, text: 'Use Grandma’s temper to destroy her house.', size: 30, italic: true, color: 'bone', font: 'head', margin: 0 },
    { t: 'text', x: 0.62, y: 5.25, w: 6.1, h: 0.95, text: 'A third-person physics comedy starring Komur, a black cat with white paws and amber eyes.', size: 16, color: 'muted', margin: 0 },
    { t: 'text', x: 0.62, y: 6.55, w: 6.2, h: 0.4, text: 'Game Jam Europe 2026  ·  plays in the browser', size: 12, color: 'amber', margin: 0 },
  ] },
  { layout: 'BO_CONTENT', section: 'The game', title: 'Taunt. Dodge. Let Granny smash it', notes: 'The core loop: the cat cannot break the big stuff; the angry homeowner does it for him.', els: [
    { t: 'img', path: IMG('bait.jpg'), x: 0.6, y: 1.55, w: 6.6, h: 6.6 * 9 / 16 },
    { t: 'text', x: 0.6, y: 5.42, w: 6.6, h: 0.8, text: 'Grandma winds up an axe; its glowing arc runs past Komur to the plant chandelier’s rope in the conservatory.', size: 12, italic: true, color: 'muted', margin: 0 },
    ...step(1, 7.65, 1.6, 'TAUNT', 'Meow at Grandma until she reaches for the heavy cutlery.'),
    ...step(2, 7.65, 2.75, 'AIM', 'Stand in front of a glowing weak spot: her throw is aimed through you.'),
    ...step(3, 7.65, 3.9, 'DODGE', 'Gallop clear at the last moment. A hit leaves you seeing stars, and she grabs.'),
    ...step(4, 7.65, 5.05, 'SHE SMASHES IT', 'Ropes, stoves, floors, the glass roof, and finally the roof brace.'),
    { t: 'text', x: 7.65, y: 6.3, w: 5.2, h: 0.55, text: '“GRANNY DID IT” doubles the points.', size: 16, italic: true, color: 'green', font: 'head', margin: 0 },
  ] },
  { layout: 'BO_CONTENT', section: 'The game', title: 'A cat that moves like one, a house that breaks like one', notes: 'Technical execution: everything here was built during the jam on top of two licensed base characters.', els: [
    ...stat(0.6, 1.6, '375', 'breakable props'),
    ...stat(2.6, 1.6, '42', 'cat animations'),
    ...stat(4.6, 1.6, '77', 'voiced lines'),
    ...stat(6.6, 1.6, '9', 'disasters'),
    ...card(0.6, 3.25, 3.9, 1.9, 'Komur in headless Blender', 'Recoloured base model, 38 procedural clips: catwalk, gallop, aimed leaps, climbs, grooming. A runtime layer bends spine, tail and head.'),
    ...card(4.7, 3.25, 3.9, 1.9, 'Grandma’s brain', 'Sight and hearing, A* across two floors and the garden, telegraphed throws steered by the cat’s bait.'),
    ...card(0.6, 5.35, 3.9, 1.6, 'Physics destruction', 'Rapier rigid bodies; props fracture into persistent debris, then five authored set pieces take over.'),
    ...card(4.7, 5.35, 3.9, 1.6, 'Runs in a browser tab', 'three.js WebGL2 with no shader hitches; music that follows the chase; touch controls on phones.'),
    { t: 'img', path: IMG('chandelier.jpg'), x: 8.85, y: 1.6, w: 3.9, h: 3.9 * 9 / 16 },
    { t: 'img', path: IMG('hero.jpg'), x: 8.85, y: 3.95, w: 3.9, h: 3.9 * 9 / 16 },
    { t: 'text', x: 8.85, y: 6.25, w: 3.9, h: 0.7, text: 'The Last Supper (top); Komur on the dining table.', size: 11, italic: true, color: 'muted', margin: 0 },
  ] },
  { layout: 'BO_CONTENT', section: 'The game', title: 'The angrier she gets, the more the house loses', notes: 'Progression: rage phases unlock heavier weapons; disasters unlock the finale; scoring rewards chains and making Grandma do it.', els: [
    { t: 'text', x: 0.6, y: 1.55, w: 4.6, h: 0.4, text: 'GRANDMA’S RAGE', size: 14, bold: true, color: 'muted', charSpacing: 2, margin: 0 },
    // matches Grandma.js: no throws below rage 25; teapot/plate, then pan/teapot, then axe/spear (weaponForPhase)
    ...[['Suspicious', 'mutters and follows noises'], ['Hunting', 'chases you; teapots and plates'], ['Enraged', 'the good china, the frying pan'], ['Furious', 'axes and pitchforks'], ['MELTDOWN', 'tantrums and the enchanted axe']].flatMap(([a, b], i) => [
      { t: 'rect', x: 0.6, y: 2.05 + i * 0.78, w: 4.6, h: 0.66, fill: i === 4 ? 'red' : 'plum', radius: 0.1, transparency: i === 4 ? 10 : 0 },
      { t: 'text', x: 0.8, y: 2.05 + i * 0.78, w: 1.6, h: 0.66, text: a, size: 15, bold: true, color: i === 4 ? 'ink' : 'amber', valign: 'middle', font: 'head', margin: 0 },
      { t: 'text', x: 2.45, y: 2.05 + i * 0.78, w: 2.65, h: 0.66, text: b, size: 13, color: i === 4 ? 'ink' : 'bone', valign: 'middle', margin: 0 },
    ]),
    { t: 'img', path: IMG('aftermath.jpg'), x: 5.6, y: 1.55, w: 7.15, h: 7.15 * 9 / 16 },
    { t: 'text', x: 5.6, y: 5.72, w: 7.15, h: 0.45, text: 'The Last Supper  ·  The Kitchen Curse  ·  The Bedroom Below  ·  The Glass House  ·  The Final Straw', size: 13, bold: true, color: 'amber', margin: 0 },
    { t: 'text', x: 5.6, y: 6.15, w: 7.15, h: 0.8, text: 'Plus four bonus disasters, combos up to x5, 16 achievements and a rank. Damage persists. Get caught after the tutorial and it’s into her cauldron.', size: 13, color: 'bone', margin: 0 },
  ] },
  { layout: 'BO_CONTENT', section: 'Komur', title: 'So who’s the bad omen?', notes: 'Why Komur matters: the superstition is the premise, the cat is the mechanic and the narrator.', els: [
    { t: 'img', path: IMG('portrait.jpg'), x: 0.6, y: 1.55, w: 5.6, h: 5.6 * 9 / 16 },
    ...card(6.6, 1.55, 6.15, 1.25, 'The superstition is the premise', 'Grandma blames the black cat for her bad luck, then demolishes her own house trying to catch him.'),
    ...card(6.6, 2.95, 6.15, 1.25, 'The cat is the mechanic', 'Leaps, swipes, taunts and dodges. Komur has no weapons, only mischief and timing.'),
    ...card(6.6, 4.35, 6.15, 1.25, 'The cat is the narrator', 'A dry inner monologue against an increasingly unhinged Grandma: “I barely lifted a paw.”'),
    { t: 'text', x: 0.6, y: 4.85, w: 5.6, h: 0.9, text: 'WASD walk  ·  Shift gallop  ·  Space leap  ·  Click swipe  ·  F taunt  ·  E hide / scratch  ·  phones and tablets: touch controls, in landscape', size: 13, color: 'bone', margin: 0 },
    { t: 'text', x: 0.6, y: 5.85, w: 12.15, h: 0.45, text: 'Play in the browser: [link to be added on upload]', size: 16, bold: true, color: 'amber', margin: 0 },
    { t: 'text', x: 0.6, y: 6.35, w: 12.15, h: 0.6, text: 'Komur’s base model: “Somali Cat Animated ver 1.2” by DreamNoms (CC BY 4.0)  ·  Grandma: Adobe Mixamo  ·  wood textures: Poly Haven (CC0)  ·  voices: ElevenLabs  ·  music: Bombinsound (Pixabay), ElevenLabs', size: 11, color: 'muted', margin: 0 },
  ] },
];

// ------------------------------------------------------------------ pptx renderer
async function buildPptx(out) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'BAD OMEN';
  pres.author = 'BAD OMEN (Game Jam Europe 2026)';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const SCH = { ink: C.text1, bone: C.background1, plum: C.text2, muted: C.background2, amber: C.accent1, green: C.accent2, red: C.accent3, violet: C.accent4, deep: C.accent5, purple: C.accent6 };
  pres.defineSlideMaster({ title: 'BO_TITLE', background: { color: SCH.ink } });
  pres.defineSlideMaster({ title: 'BO_CONTENT', background: { color: SCH.ink },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.45, w: 12.15, h: 0.85, fontFace: THEME.headFontFace, fontSize: 32, bold: true, color: SCH.bone, valign: 'middle', margin: 0 }, text: '' } },
      { text: { text: 'BAD OMEN  ·  Game Jam Europe 2026', options: { x: 0.6, y: 7.05, w: 6, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 10, color: SCH.muted, margin: 0 } } },
    ],
    slideNumber: { x: 12.35, y: 7.05, w: 0.4, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 10, color: SCH.muted, align: 'right' } });
  let section = null;
  SLIDES.forEach((s, si) => {
    if (s.section !== section) { section = s.section; pres.addSection({ title: section }); }
    const slide = pres.addSlide({ masterName: s.layout, sectionTitle: section });
    if (s.title) slide.addText(s.title, { placeholder: 'title' });
    s.els.forEach((e, k) => {
      const name = `s${si + 1}_${e.t}${k}`;
      if (e.t === 'img') slide.addImage({ path: e.path, x: e.x, y: e.y, w: e.w, h: e.h, objectName: name, altText: path.basename(e.path) });
      else if (e.t === 'rect' || e.t === 'oval') {
        const shape = e.t === 'oval' ? pres.ShapeType.ellipse : e.radius ? pres.ShapeType.roundRect : pres.ShapeType.rect;
        slide.addShape(shape, { x: e.x, y: e.y, w: e.w, h: e.h, fill: { color: SCH[e.fill], transparency: e.transparency ?? 0 }, line: { type: 'none' }, rectRadius: e.radius, objectName: name });
      } else if (e.t === 'text') {
        slide.addText(e.text, { x: e.x, y: e.y, w: e.w, h: e.h, fontSize: e.size, bold: !!e.bold, italic: !!e.italic, color: SCH[e.color],
          fontFace: e.font === 'head' ? THEME.headFontFace : THEME.bodyFontFace, align: e.align ?? 'left', valign: e.valign ?? 'top',
          charSpacing: e.charSpacing, margin: e.margin ?? 0, isTextBox: true, objectName: name, fit: 'none' });
      }
    });
    if (s.notes) slide.addNotes(s.notes);
  });
  await pres.writeFile({ fileName: out });
}

// ------------------------------------------------------------------ html renderer (preview + pdf)
function html() {
  const px = (inch) => (inch * 96).toFixed(2) + 'px';
  const pt = (p) => (p * 96 / 72).toFixed(2) + 'px';
  const hex = (k) => '#' + PAL[k];
  const rgba = (k, tr = 0) => { const h = PAL[k]; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4), 16)},${1 - tr / 100})`; };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const slides = SLIDES.map((s, si) => {
    const parts = [];
    if (s.layout === 'BO_CONTENT') {
      parts.push(`<div style="position:absolute;left:${px(0.6)};top:${px(0.45)};width:${px(12.15)};height:${px(0.85)};display:flex;align-items:center;font:bold ${pt(32)}/1.2 Cambria;color:${hex('bone')}">${esc(s.title)}</div>`);
      parts.push(`<div style="position:absolute;left:${px(0.6)};top:${px(7.05)};font:${pt(10)}/1.2 Calibri;color:${hex('muted')}">BAD OMEN · Game Jam Europe 2026</div>`);
      parts.push(`<div style="position:absolute;right:${px(0.58)};top:${px(7.05)};font:${pt(10)}/1.2 Calibri;color:${hex('muted')}">${si + 1}</div>`);
    }
    for (const e of s.els) {
      const box = `position:absolute;left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};`;
      if (e.t === 'img') parts.push(`<img src="file:///${e.path.replace(/\\/g, '/')}" style="${box}object-fit:fill">`);
      else if (e.t === 'rect') parts.push(`<div style="${box}background:${rgba(e.fill, e.transparency)};border-radius:${e.radius ? px(e.radius) : 0}"></div>`);
      else if (e.t === 'oval') parts.push(`<div style="${box}background:${rgba(e.fill)};border-radius:50%"></div>`);
      else if (e.t === 'text') {
        const ff = e.font === 'head' ? 'Cambria' : 'Calibri';
        const jc = e.valign === 'middle' ? 'center' : e.valign === 'bottom' ? 'flex-end' : 'flex-start';
        parts.push(`<div class="t" style="${box}display:flex;flex-direction:column;justify-content:${jc};text-align:${e.align ?? 'left'};font:${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}${pt(e.size)}/1.2 ${ff};color:${hex(e.color)};letter-spacing:${e.charSpacing ? pt(e.charSpacing) : 'normal'}"><span>${esc(e.text)}</span></div>`);
      }
    }
    return `<section style="position:relative;width:1280px;height:720px;overflow:hidden;background:${hex('ink')};page-break-after:always">${parts.join('')}</section>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:1280px 720px;margin:0}body{margin:0;background:#000}</style></head><body>${slides.join('')}</body></html>`;
}

async function renderPreview(htmlFile, pdfOut, pngDir) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file:///' + htmlFile.replace(/\\/g, '/'));
  await page.waitForLoadState('networkidle');
  // overflow check: any text box whose content is taller/wider than its box
  const over = await page.evaluate(() => [...document.querySelectorAll('.t')].map((d, i) => {
    const s = d.firstElementChild; return { i, text: s.textContent.slice(0, 40), over: s.scrollHeight > d.clientHeight + 1 || s.scrollWidth > d.clientWidth + 1, h: s.scrollHeight, box: d.clientHeight };
  }).filter((o) => o.over));
  fs.mkdirSync(pngDir, { recursive: true });
  const n = await page.locator('section').count();
  for (let i = 0; i < n; i++) await page.locator('section').nth(i).screenshot({ path: path.join(pngDir, `slide-${i + 1}.png`) });
  await page.pdf({ path: pdfOut, width: '1280px', height: '720px', printBackground: true });
  await browser.close();
  return over;
}

(async () => {
  makeLogo();
  const pptx = path.join(DIR, 'bad-omen-pitch.pptx');
  await buildPptx(pptx);
  if (process.env.APPLY_THEME) await require(process.env.APPLY_THEME).applyTheme(pptx, THEME);
  const htmlFile = path.join(DIR, 'preview', 'deck.html');
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, html());
  const over = await renderPreview(htmlFile, path.join(DIR, 'bad-omen-pitch.pdf'), path.join(DIR, 'preview'));
  console.log('pptx', pptx);
  console.log('overflowing text boxes:', over.length ? JSON.stringify(over) : 'none');
})();
