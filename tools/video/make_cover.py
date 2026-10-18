# itch.io cover (630x500) from an in-game still: crop to the cover's aspect around a focus point, a dark band
# behind the title, the game's logo font for BAD OMEN and the tagline under it.
# Usage: python tools/video/make_cover.py <still.png|jpg> <out.png> [focus_x=0.5] [title_top=14]
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

src, out = sys.argv[1], sys.argv[2]
focus = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
top = int(sys.argv[4]) if len(sys.argv) > 4 else 14
W, H = 630, 500
FONTS = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'fonts')

im = Image.open(src).convert('RGB')
cw = round(im.height * W / H)
if cw <= im.width:
    x0 = min(max(0, round(im.width * focus - cw / 2)), im.width - cw)
    im = im.crop((x0, 0, x0 + cw, im.height))
else:  # taller than the cover: crop height instead
    ch = round(im.width * H / W)
    im = im.crop((0, 0, im.width, ch))
im = im.resize((W, H), Image.LANCZOS)

# a soft dark band at the top so the title reads over any scene
band = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(band)
for y in range(0, 190):
    d.line([(0, y), (W, y)], fill=int(205 * (1 - y / 190) ** 1.6))
im = Image.composite(Image.new('RGB', (W, H), (8, 5, 12)), im, band)

title = ImageFont.truetype(os.path.join(FONTS, 'Creepster-Regular.ttf'), 92)
tag = ImageFont.truetype(os.path.join(FONTS, 'IMFellEnglish-Italic.ttf'), 27)


def centred(draw, text, font, y, fill):
    w = draw.textlength(text, font=font)
    draw.text(((W - w) / 2, y), text, font=font, fill=fill)


# drop shadow (blurred) under the title, then the title itself
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
centred(ImageDraw.Draw(shadow), 'BAD OMEN', title, top + 6, (0, 0, 0, 230))
im = Image.alpha_composite(im.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(5)))
draw = ImageDraw.Draw(im)
centred(draw, 'BAD OMEN', title, top, (255, 174, 26, 255))
centred(draw, 'One cat. Two floors. No deposit refunds.', tag, top + 108, (243, 230, 200, 255))
im.convert('RGB').save(out)
print('cover', out, im.size)
