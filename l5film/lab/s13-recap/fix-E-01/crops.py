#!/usr/bin/env python3
"""Group E's fix round E-01: before-and-after crops from the clip stills (the old ones kept in each lab's
fix-E-01/old/, the new ones in the lab). Each sheet stacks labelled crops, at their own pixels unless scaled.

  python3 lab/s13-recap/fix-E-01/crops.py      (from P)
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.normpath(os.path.join(HERE, '..', '..', '..'))


def lab(sid, *p):
    return os.path.join(P, 'lab', sid, *p)


def sheet(out, panels, width=None):
    """panels: [(path, (x0, y0, x1, y1), scale, label, marks)], marks: [('x'|'y', value, text)]"""
    ims = []
    for path, box, k, label, marks in panels:
        im = Image.open(path).convert('RGB').crop(box)
        im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS if k < 1 else Image.NEAREST)
        top = 26
        c = Image.new('RGB', (im.width + 70, im.height + top + 22), (10, 12, 18))
        c.paste(im, (70, top))
        d = ImageDraw.Draw(c)
        d.text((6, 6), label, fill=(235, 235, 235))
        for kind, v, txt in marks:
            if kind == 'y':
                y = top + (v - box[1]) * k
                d.line([(50, y), (68, y)], fill=(255, 90, 90), width=2)
                d.text((2, y - 6), txt, fill=(255, 130, 130))
            else:
                x = 70 + (v - box[0]) * k
                y = top + im.height
                d.line([(x, y + 2), (x, y + 14)], fill=(255, 90, 90), width=2)
                d.text((x + 4, y + 4), txt, fill=(255, 130, 130))
        ims.append(c)
    W = max(i.width for i in ims)
    H = sum(i.height for i in ims) + 6 * (len(ims) - 1)
    s = Image.new('RGB', (W, H), (30, 32, 38))
    y = 0
    for i in ims:
        s.paste(i, (0, y))
        y += i.height + 6
    s.save(out)
    print(os.path.relpath(out, P), s.size)


def old(sid, t):
    return lab(sid, 'fix-E-01', 'old', f'clip-still-{t}.png')


def new(sid, t):
    return lab(sid, f'clip-still-{t}.png')


FULL = (0, 0, 1920, 1080)
if __name__ == '__main__':
    s13 = 's13-recap'
    o = lab(s13, 'fix-E-01')
    # item 1: the answer holds before the clean break; "Voice Mirror" 0.4 s after the panel
    sheet(os.path.join(o, 'item1-hold.png'), [
        (old(s13, '27.64'), FULL, 0.4, 'BEFORE 27.64: the line done at 27.505, the frame already leaving (cascade from break + 0.06)', []),
        (new(s13, '27.10'), FULL, 0.4, 'AFTER 27.10: the redraw done at 27.04 (1.935 s, 10 / 1.935), the answer complete', []),
        (new(s13, '27.50'), FULL, 0.4, 'AFTER 27.50: still holding, 0.46 s on (the cascade starts at 27.54, 0.50 s after the redraw ends)', []),
        (new(s13, '27.80'), FULL, 0.4, 'AFTER 27.80: the cascade under way (kicker 27.54, panel 27.61, answer 27.68, frame 27.75), all gone by 28.05', []),
        (new(s13, '28.27'), FULL, 0.4, 'AFTER 28.27: hop 1 at its apex (about 28.27), the recap gone 0.21 s before', []),
    ])
    sheet(os.path.join(o, 'item1-voice-mirror.png'), [
        (old(s13, '30.06'), (200, 60, 1140, 340), 0.8, 'BEFORE 30.06: the panel and "Practise it." only; "Voice Mirror" waited for its word (30.87)', []),
        (new(s13, '29.94'), (200, 60, 1140, 340), 0.8, 'AFTER 29.94: the panel and "Practise it." (29.56)', []),
        (new(s13, '30.20'), (200, 60, 1140, 340), 0.8, 'AFTER 30.20: "Voice Mirror" landing, 0.4 s after the panel (29.96)', []),
        (new(s13, '30.60'), (200, 60, 1140, 340), 0.8, 'AFTER 30.60: "Voice Mirror" and its rule in', []),
    ])
    # item 2: the ten line
    sheet(os.path.join(o, 'item2-ten-line.png'), [
        (old(s13, '50.59'), (200, 600, 1400, 880), 1.0, 'BEFORE 50.59: Inter 32 to x 1146 (past the card\'s edge 1110), 6 px under the panel\'s foot (790)',
         [('y', 790, '790'), ('y', 840, '840'), ('x', 1110, '1110'), ('x', 1146, '1146')]),
        (new(s13, '50.59'), (200, 600, 1400, 880), 1.0, 'AFTER 50.59: Inter 30, x 270 to 1100, ink 797 to 827; the panel\'s foot 777 (closed up 13 px), 20 px over the cap top',
         [('y', 777, '777'), ('y', 797, '797'), ('y', 827, '827'), ('y', 840, '840'), ('x', 1100, ''), ('x', 1110, '   1110')]),
    ])
    sheet(os.path.join(o, 'item2-card-whole.png'), [
        (old(s13, '60.47'), (200, 60, 1720, 880), 0.6, 'BEFORE 60.47: both cards', []),
        (new(s13, '60.47'), (200, 60, 1720, 880), 0.6, 'AFTER 60.47: both cards; the Voice Mirror card closed up under its rows', []),
    ])
    # item 3: the frame fill
    sheet(os.path.join(o, 'item3-fill.png'), [
        (old(s13, '3.27'), FULL, 0.4, 'BEFORE 3.27: the figure at k 0.75 (x 1262 to 1420), the band at 35 %', []),
        (new(s13, '3.27'), FULL, 0.4, 'AFTER 3.27: the figure at k 0.9 (1.2 times; crown y 63, x 1300 to 1490), the band at 20 %', []),
        (old(s13, '9.15'), FULL, 0.4, 'BEFORE 9.15: the traces x 1180 to 1640, centres 200 / 320 / 440, no chip', []),
        (new(s13, '9.15'), FULL, 0.4, 'AFTER 9.15: the traces at 1.2 times, x 1136 to 1688, centres 170 / 314 / 458, with their ILLUSTRATION chip', []),
    ])
    # item 4: the traces' chip
    sheet(os.path.join(o, 'item4-chip.png'), [
        (new(s13, '9.15'), (960, 40, 1720, 660), 0.7, 'AFTER 9.15: the chip over the stack (1417 to 1688, y 62 to 102), 14 px over the top trace', []),
        (new(s13, '19.10'), (960, 40, 1720, 660), 0.7, 'AFTER 19.10: the traces and their chip leaving with the question\'s swap (from 18.945, 0.4 s)', []),
        (new(s13, '19.40'), (960, 40, 1720, 660), 0.7, 'AFTER 19.40: both gone (19.345); card 3\'s labels not yet (from 19.48): no chip', []),
        (new(s13, '20.18'), (960, 40, 1720, 660), 0.7, 'AFTER 20.18: card 3\'s chip (right-aligned 1688, y 500) with the frame back to full', []),
        (old(s13, '19.75'), (960, 40, 1720, 660), 0.7, 'BEFORE 19.75 (the old clip): the traces fading while card 3\'s chip came in over the Together trace', []),
    ])
    s14 = 's14-next'
    o = lab(s14, 'fix-E-01')
    sheet(os.path.join(o, 'item5-bead.png'), [
        (old(s14, '0.30'), (200, 300, 1560, 800), 0.5, 'BEFORE 0.30: the carried bead alone in the frame', []),
        (new(s14, '0.30'), (200, 300, 1560, 800), 0.5, 'AFTER 0.30: the rows and the six outlines coming in from S14\'s first frame (0.6 s)', []),
        (old(s14, '1.43'), (200, 300, 1560, 800), 0.5, 'BEFORE 1.43: the carried bead emptied to an outline', []),
        (new(s14, '1.43'), (200, 300, 1560, 800), 0.5, 'AFTER 1.43: the carried bead filled at C4, as it arrived', []),
        (new(s14, '1.70'), (200, 300, 1560, 800), 0.5, 'AFTER 1.70: still filled, just before its note (1.74)', []),
        (new(s14, '1.84'), (200, 300, 1560, 800), 0.5, 'AFTER 1.84: its note: the first bead lit blue, the carried bead given way (0.2 s)', []),
    ])
    sheet(os.path.join(o, 'item6-tease-line.png'), [
        (old(s14, '6.36'), (80, 60, 1560, 320), 0.8, 'BEFORE 6.36: the tease line at baseline 150, 9 px under "NEXT TIME"', [('y', 110, '110')]),
        (new(s14, '6.36'), (80, 60, 1560, 320), 0.8, 'AFTER 6.36: baseline 170, its ink top 137, 27 px under the kicker\'s foot (110)', [('y', 110, '110'), ('y', 137, '137'), ('y', 170, '170')]),
    ])
