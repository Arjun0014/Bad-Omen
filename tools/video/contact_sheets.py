# Contact sheets for the trailer recording: one grid per shot, a frame every `step` seconds, labelled with the
# offset into the shot (the numbers the TRAILER / GIFS cut lists use).
# Usage: python contact.py <raw dir> <out dir> [step=0.5] [shots=a,b]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
S = json.load(open(os.path.join(raw, 'session.json')))
frames = json.load(open(os.path.join(raw, 'frames.json')))
os.makedirs(out, exist_ok=True)
try:
    font = ImageFont.truetype('arial.ttf', 22)
except Exception:
    font = ImageFont.load_default()
for s in S['shots']:
    if only and s['name'] not in only:
        continue
    t, picks = s['t0'], []
    while t <= s['t1']:
        best = min(frames, key=lambda f: abs(f['t'] - t))
        picks.append((t - s['t0'], best['i']))
        t += step
    cols = 6
    rows = (len(picks) + cols - 1) // cols
    W, H = 320, 180
    sheet = Image.new('RGB', (cols * W, rows * H), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for k, (off, i) in enumerate(picks):
        im = Image.open(os.path.join(raw, 'frames', f'f{i:05d}.jpg')).convert('RGB').resize((W, H))
        x, y = (k % cols) * W, (k // cols) * H
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + 74, y + 26], fill=(0, 0, 0))
        d.text((x + 4, y + 2), f'{off:5.1f}', fill=(255, 200, 40), font=font)
    sheet.save(os.path.join(out, f"sheet_{s['name']}.jpg"), quality=82)
    print(s['name'], f"{s['t1'] - s['t0']:.1f}s", len(picks), 'thumbs')
