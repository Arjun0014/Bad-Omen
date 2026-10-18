# Store screenshots out of a capture_trailer.mjs recording: name=shot@seconds (negative = from the shot's end).
# Usage: python tools/video/extract_stills.py <raw dir> <out dir> 01_title=menu@2.5 04_the_last_supper=bait@18.6 ...
import json
import os
import shutil
import sys

from PIL import Image

raw, out = sys.argv[1], sys.argv[2]
S = json.load(open(os.path.join(raw, 'session.json')))
frames = json.load(open(os.path.join(raw, 'frames.json')))
shots = {s['name']: s for s in S['shots']}
os.makedirs(out, exist_ok=True)
for spec in sys.argv[3:]:
    name, at = spec.split('=')
    shot, off = at.split('@')
    s = shots[shot]
    t = s['t0'] + float(off) if float(off) >= 0 else s['t1'] + float(off)
    f = min(frames, key=lambda fr: abs(fr['t'] - t))
    src = os.path.join(raw, 'frames', f"f{f['i']:05d}.jpg")
    shutil.copyfile(src, os.path.join(out, name + '.jpg'))  # the screencast's own JPEG: no second encode
    print(name, shot, off, f"f{f['i']:05d}", Image.open(src).size)
