# Group D's fix round F-01: before and after crops for each item, from the D-01 round's clip stills (fix-F-01/before/)
# and this round's (the lab folder), side by side, each with its caption. Writes lab/<sid>/fix-F-01/<item>.png.
#   python3 crops.py [<sid> ...]   (default: both scenes)
import os, sys
ONLY = sys.argv[1:]
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
FONT = ImageFont.truetype(f'{ROOT}/assets/fonts/Outfit-wght.ttf', 26)
try: FONT.set_variation_by_axes([600])
except Exception: pass
def still(sid, t, before):
    d = f'{ROOT}/lab/{sid}/fix-F-01/before' if before else f'{ROOT}/lab/{sid}'
    return Image.open(f'{d}/clip-still-{t}.png').convert('RGB')
def pair(sid, name, tb, ta, box, cap_b, cap_a, scale=1.0):
    if ONLY and sid not in ONLY: return
    a, b = still(sid, tb, True).crop(box), still(sid, ta, False).crop(box)
    if scale != 1: a, b = [im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS) for im in (a, b)]
    W, Hh = a.width, a.height
    out = Image.new('RGB', (W * 2 + 24, Hh + 52), (8, 10, 16))
    out.paste(a, (0, 52)); out.paste(b, (W + 24, 52))
    dr = ImageDraw.Draw(out)
    dr.text((8, 12), f'before, {tb} s: {cap_b}', font=FONT, fill=(200, 200, 210))
    dr.text((W + 32, 12), f'after, {ta} s: {cap_a}', font=FONT, fill=(230, 237, 243))
    os.makedirs(f'{ROOT}/lab/{sid}/fix-F-01', exist_ok=True)
    out.save(f'{ROOT}/lab/{sid}/fix-F-01/{name}.png')
    print(f'lab/{sid}/fix-F-01/{name}.png')
FULL = (0, 0, 1920, 1080)
pair('s12-your-turn', '1-doctor-lines-light-as-said', '64.72', '64.47', FULL, 'all seven at ink as they rise', 'three said and lit, four at ink-2', 0.5)
pair('s12-your-turn', '1b-stop-line-second-line', '17.84', '17.84', (240, 500, 980, 620), 'both lines at ink on "Stop"', 'its second line at ink-2 until "feels"')
pair('s12-your-turn', '2-band-dims-after-the-hold', '45.99', '45.99', FULL, 'the band at full beside the feel block', 'the band at 50 %', 0.5)
pair('s12-your-turn', '2b-band-back-before-recap', '75.16', '76.20', (900, 80, 1860, 400), 'the band at full', 'back at full 0.59 s before the cut')
pair('s12-your-turn', '3-feel-block-contrast', '70.00', '70.00', (980, 410, 1700, 740), 'at 35 %: 2.7 to 3.0:1', 'at 55 %: 4.8 to 5.5:1')
pair('s12-your-turn', '4-ring-breath-composited', '24.65', '24.65', (1150, 330, 1840, 840), 'the breath laid out each frame', 'the breath on a composited layer')
pair('s11-sing', '5-settle-fills-the-hold', '19.07', '19.70', (240, 220, 980, 380), 'still from 19.50 to 20.00', 'the settle on "singing" (1.06)')
