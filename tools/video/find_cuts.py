# Camera cuts inside each shot of a capture_trailer.mjs recording: offsets (seconds into the shot) where consecutive
# frames differ a lot (mean absolute difference of small greyscale copies).  The trailer's segments should not run
# across one of these (a frame of the next camera angle at a segment's end reads as a glitch).
# Usage: python tools/video/find_cuts.py <raw dir> [threshold=28] [shots=a,b]
import json
import os
import sys

from PIL import Image, ImageChops, ImageStat

raw = sys.argv[1]
thr = float(sys.argv[2]) if len(sys.argv) > 2 else 28
only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
S = json.load(open(os.path.join(raw, 'session.json')))
frames = json.load(open(os.path.join(raw, 'frames.json')))
small = lambda i: Image.open(os.path.join(raw, 'frames', f'f{i:05d}.jpg')).convert('L').resize((96, 54))
for s in S['shots']:
    if only and s['name'] not in only:
        continue
    fr = [f for f in frames if s['t0'] <= f['t'] <= s['t1']]
    cuts, prev = [], None
    for f in fr:
        im = small(f['i'])
        if prev is not None:
            d = ImageStat.Stat(ImageChops.difference(im, prev)).mean[0]
            if d > thr:
                cuts.append(f"{f['t'] - s['t0']:.2f}({d:.0f})")
        prev = im
    print(s['name'], f"{s['t1'] - s['t0']:.1f}s", ' '.join(cuts) or '-')
