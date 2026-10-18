# Decode the game's JPG textures to raw RGBA (+ a JSON of sizes) for the Node KTX2 encoder.
import json, os, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
sizes = {}
for name in sorted(os.listdir(src)):
    if not name.lower().endswith('.jpg'):
        continue
    im = Image.open(os.path.join(src, name)).convert('RGBA')
    base = os.path.splitext(name)[0]
    with open(os.path.join(out, base + '.rgba'), 'wb') as f:
        f.write(im.tobytes())
    sizes[base] = [im.width, im.height]
with open(os.path.join(out, 'sizes.json'), 'w') as f:
    json.dump(sizes, f, indent=1)
print(len(sizes), 'decoded')
