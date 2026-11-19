# Group D's fix round (D-01): before and after crops for each item, from the first build's clip stills (fix-D-01/before/)
# and this round's (the lab folder), side by side, each with its caption. Writes lab/<sid>/fix-D-01/<item>.png.
#   python3 crops.py [<sid> ...]   (default: both scenes)
import os, sys
ONLY = sys.argv[1:]
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
FONT = ImageFont.truetype(f'{ROOT}/assets/fonts/Outfit-wght.ttf', 26)
try: FONT.set_variation_by_axes([600])
except Exception: pass
def still(sid, t, before):
    d = f'{ROOT}/lab/{sid}/fix-D-01/before' if before else f'{ROOT}/lab/{sid}'
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
    os.makedirs(f'{ROOT}/lab/{sid}/fix-D-01', exist_ok=True)
    out.save(f'{ROOT}/lab/{sid}/fix-D-01/{name}.png')
    print(f'lab/{sid}/fix-D-01/{name}.png')
FULL = (0, 0, 1920, 1080)
pair('s11-sing', '1-ring-on-ten-seconds', '6.22', '6.80', FULL, 'no picture until 35.3 s', 'the ring under the bracket from "seconds"', 0.5)
pair('s12-your-turn', '1-reasons-leave-on-b38', '1.18', '1.18', FULL, 'the six reasons on', 'they left on "Otherwise,"', 0.5)
pair('s12-your-turn', '2-doctor-lines-own-the-end', '64.72', '64.72', FULL, 'font breaks, the feel block at full', 'phrase breaks, the feel block at 35 %', 0.5)
pair('s12-your-turn', '3-labels-leave-with-the-ring', '45.99', '45.99', FULL, '"0", "10 s" and the voices stay', 'only "Nothing listens" stays', 0.5)
pair('s12-your-turn', '4-breathe-in-clear-of-the-ring', '24.65', '24.65', (1180, 300, 1840, 560), 'the tick 2 rows under the "B"', "its tick 13 rows under the label's foot")
pair('s12-your-turn', '5-ring-above-the-floor', '30.59', '30.59', (1100, 640, 1660, 900), 'the stroke across y 840', '23 rows clear at rest')
pair('s12-your-turn', '5b-row-above-the-floor-f0', '17.84', '17.84', (1040, 640, 1600, 900), 'a line across y 840', 'its last ink 14 rows above y 840')
pair('s12-your-turn', '6-phase-row-lit-word', '8.60', '8.70', (1040, 700, 1600, 880), 'all three lit alike', '"SING" lit with its mark')
pair('s12-your-turn', '6b-feel-line-words', '45.99', '45.99', (980, 500, 1700, 740), '"rest a few easy breaths"', '"rest for a few easy breaths"')
