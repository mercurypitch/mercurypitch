"""The Merc passes' contact sheet: stills of the moments the brief names, decoded from the rendered
WebMs (alpha kept) and shown as the scenes will show them (Tavi mirrored, over the room's obsidian),
and a row that stands the hosts on the floor at y 840 by merc/PASSES.md's rules (the feet line, the
mirror, the root cancelled on a hop), so the placement numbers are tested on the picture.

  python3 tools/merc-sheet.py            writes review/merc/contact-sheet.png

Times are film times on the voiced clock, read from the cues where a moment is anchored to one.
Uses ffmpeg (libvpx-vp9, to keep the alpha), numpy and PIL (the system python3).
"""
import importlib.util
import json
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
_sj = open(os.path.join(ROOT, 'assets/scenes.js')).read()
SC = json.loads(_sj[_sj.index('=') + 1:].strip().rstrip(';'))
BG = np.array([13, 17, 23], dtype=np.float32)
INK = (230, 237, 243)
INK2 = (139, 148, 158)
FONT = os.path.join(ROOT, 'assets/fonts/Outfit-wght.ttf')
_spec = importlib.util.spec_from_file_location('merc_passes', os.path.join(HERE, 'merc-passes.py'))
_mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mp)
SOLE = _mp.sole_line()   # merc/PASSES.md's feet line, measured on the dumped frames
PXU = 0.4353       # shown px per world unit per px of the shown frame


def cue(cid, edge='start', off=0.0):
    return C[cid][edge] + off


def word(cid, w, off=0.0):
    """Film time of a line's word (its first occurrence)."""
    return next(s for x, s, e in C[cid]['words'] if x.strip('.,?!:;"').lower() == w.lower()) + off


def shot(pid):
    return json.load(open(os.path.join(ROOT, 'merc', 'shots', pid + '.json')))


def grab(pid, t):
    """(RGBA float array 0..1 of the drawn square, root [x, y], label of the source) at film time t."""
    s = shot(pid)
    n = round(s['duration'] * s['fps'])
    f = min(n - 1, max(0, round((t - s['filmStart']) * s['fps'])))
    src, first = s['id'], 0
    if s.get('chunks'):
        scene = next((k for k, v in SC.items() if v['start'] <= t < v['end']), None)
        fits = [c for c in s['chunks'] if c['from'] <= f <= c['to']]
        c = next((c for c in fits if c['scene'] == scene), fits[0])
        src, first = c['id'], c['from']
    side = json.load(open(os.path.join(ROOT, 'assets', 'merc', src + '-merc.json')))
    w, h = side['drawn']
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9',
                          '-i', os.path.join(ROOT, 'assets', 'merc', src + '-merc.webm'),
                          '-vf', f'select=eq(n\\,{f - first})', '-vframes', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    img = np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 4).astype(np.float32) / 255
    if s.get('mirror'):
        img = img[:, ::-1]
    return img, side['root'][f - first], f'{src} f{f - first}'


def over(img, size):
    """The straight-alpha frame over the obsidian, scaled to size x size."""
    a = img[..., 3:4]
    rgb = img[..., :3] * 255 * a + BG * (1 - a)
    return Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)


def place(canvas, img, root, fx, S, dx=0.0):
    """Stand a frame on the floor at (fx, 840) at shown size S (merc/PASSES.md), cancelling the root's x."""
    rgba = Image.fromarray((img * 255).clip(0, 255).astype(np.uint8), 'RGBA').resize((S, S), Image.LANCZOS)
    left = fx - 0.5 * S + dx - (root[0] * PXU * S if root else 0)
    top = 840 - SOLE * S
    canvas.alpha_composite(rgba, (round(left), round(top)))


def main():
    font = lambda px: ImageFont.truetype(FONT, px)
    f_h, f_l, f_s = font(26), font(16), font(13)
    for v in (f_h, f_l, f_s):
        try:
            v.set_variation_by_axes([600])
        except Exception:
            pass
    hop1 = next(c['t'] for c in shot('m-blue')['cues'] if c['state'] == 'hop') + shot('m-blue')['filmStart']
    hops = [c['t'] + shot('m-blue')['filmStart'] for c in shot('m-blue')['cues'] if c['state'] == 'hop']
    tavi_hop = [c['t'] + shot('m-orange')['filmStart'] for c in shot('m-orange')['cues'] if c['state'] == 'celebrate'][1]
    # the last frame rendered: the end card's chunk runs two frames past the film's last
    last = lambda pid: shot(pid)['filmStart'] + max(c['to'] for c in shot(pid)['chunks']) / shot(pid)['fps']
    end_o, end_b = last('m-orange'), last('m-blue')
    rows = [
        ('The leaps', [
            ('m-orange', cue('o3', 'start', -1.38 + 0.365), 'Tavi leaps in: the top', 'o3 - 1.02'),
            ('m-orange', cue('o3', 'start', -0.5), 'Tavi settled', 'o3 - 0.50'),
            ('m-blue', cue('b6', 'start', -1.38 + 0.365), 'Merc leaps in: the top', 'b6 - 1.02'),
            ('m-blue', cue('b6', 'start', -0.5), 'Merc settled', 'b6 - 0.50'),
        ]),
        ('S1, the m01 pair at 420', [
            ('m01-orange', cue('o1', 'start', 2.0), 'Tavi talks (o1)', 'o1 + 2.0'),
            ('m01-blue', cue('o1', 'start', 2.0), 'Merc listens (o1), no arcs', 'o1 + 2.0'),
            ('m01-blue', cue('b1', 'start', 4.0), 'Merc talks (b1)', 'b1 + 4.0'),
            ('m01-orange', cue('b1', 'start', 4.0), 'Tavi listens (b1), no arcs', 'b1 + 4.0'),
            ('m01-blue', cue('pushed', 'start', 2.0), 'Merc idle through pushed', 'pushed + 2.0'),
            ('m01-orange', cue('hook', 'start', 0.5), 'Tavi in the slide-out', 'hook + 0.5'),
        ]),
        ('The sung sounds', [
            ('m-blue', cue('gauge', 'start', 5.0), 'Merc sings gauge, arcs on', 'gauge + 5.0'),
            ('m-orange', cue('gauge', 'start', 5.0), 'Tavi idle through gauge', 'gauge + 5.0'),
            ('m-orange', cue('demo', 'start', 0.3), 'Tavi sings demo: the scoop', 'demo + 0.3'),
            ('m-orange', cue('demo', 'start', 5.0), 'Tavi sings demo: the wave', 'demo + 5.0'),
            ('m-blue', cue('demo', 'start', 5.0), 'Merc idle through demo', 'demo + 5.0'),
            ('m-blue', cue('listen', 'start', 1.0), 'Merc sings listen (A3)', 'listen + 1.0'),
            ('m-orange', cue('listen', 'start', 1.0), 'Tavi sings listen (A4)', 'listen + 1.0'),
            ('m-blue', cue('twinkle', 'start', 2.2), 'Merc sings twinkle (A4)', 'twinkle + 2.2'),
        ]),
        ('Hold, the hops in the card pause, the end', [
            ('m-blue', cue('hold', 'start', 5.0), 'Hold: Merc idle, no arcs', 'hold + 5.0'),
            ('m-orange', cue('hold', 'start', 5.0), 'Hold: Tavi idle, no arcs', 'hold + 5.0'),
            ('m-blue', word('b55', 'Voice', 0.15), 'Merc says "Voice Mirror"', 'b55 "Voice" + 0.15'),
            ('m-blue', hops[0] - 0.2, 'Merc before the hops', 'card + 0.15'),
            ('m-blue', hops[0] + 0.325, 'Hop 1: the top, no stop marks', 'hop 1 + 0.33'),
            ('m-blue', hops[1] + 0.325, 'Hop 2: the top', 'hop 2 + 0.33'),
            ('m-blue', hops[1] + 0.7, 'Merc landed', 'hop 2 + 0.70'),
            ('m-orange', tavi_hop + 0.365, 'Tavi hops left: the top', 'end + 0.40'),
            ('m-blue', end_b, 'Merc, the last frame', 'past the end'),
            ('m-orange', end_o, 'Tavi, the last frame', 'past the end'),
        ]),
        ('A long listen: Tavi through b37 (17.9 s), a 3 s wink, then idle held on Merc', [
            ('m-blue', cue('b37', 'start', 1.5), 'Merc talks b37', 'b37 + 1.5'),
            ('m-orange', cue('b37', 'start', 1.5), 'Tavi listens: the wink', 'b37 + 1.5'),
            ('m-orange', cue('b37', 'start', 2.9), 'Still listening', 'b37 + 2.9'),
            ('m-orange', cue('b37', 'start', 3.6), 'Idle, eyes open on Merc', 'b37 + 3.6'),
            ('m-orange', cue('b37', 'start', 5.65), 'Idle: the away glance held', 'b37 + 5.65'),
            ('m-orange', cue('b37', 'start', 8.4), 'Idle: the glance toward him', 'b37 + 8.4'),
            ('m-orange', cue('b37', 'start', 13.65), 'Idle: next away glance held', 'b37 + 13.65'),
            ('m-orange', cue('b37a', 'start', 1.0), 'Next line: the wink again', 'b37a + 1.0'),
        ]),
    ]
    CELL, LAB, PAD = 200, 64, 22
    cols = max(len(r[1]) for r in rows)
    W = PAD + cols * (CELL + PAD)
    n_place = 4
    tw0 = (W - PAD * (n_place + 1)) // n_place
    place_h = round(tw0 * 1080 / 1920) + 30
    zoom_h = 330
    H = PAD + sum(36 + CELL + LAB + PAD for _ in rows) + 36 + place_h + 36 + zoom_h + PAD + 30
    sheet = Image.new('RGB', (W, H), (22, 27, 34))
    d = ImageDraw.Draw(sheet)
    y = PAD
    for title, cells in rows:
        d.text((PAD, y + 4), title, font=f_h, fill=INK)
        y += 36
        for i, (pid, t, lab, anchor) in enumerate(cells):
            img, root, src = grab(pid, t)
            x = PAD + i * (CELL + PAD)
            sheet.paste(over(img, CELL), (x, y))
            d.text((x, y + CELL + 4), lab, font=f_l, fill=INK)
            d.text((x, y + CELL + 24), f'{t:.2f} ({anchor})', font=f_s, fill=INK2)
            d.text((x, y + CELL + 41), src, font=f_s, fill=INK2)
        y += CELL + LAB + PAD
    # placement: whole frames at 1920 x 1080, scaled to fit, the floor line at y 840
    d.text((PAD, y + 4), 'Placement by PASSES.md: feet at y 840 (the line), Tavi mirrored, the hop\'s root cancelled', font=f_h, fill=INK)
    y += 36
    scenes = [
        ('S1 at 420: Merc (230, 840), Tavi (1690, 840)', [('m01-blue', 230, 420, 0), ('m01-orange', 1690, 420, 0)], cue('o1', 'start', 2.0)),
        ('Corners at 300: (110, 840), (1800, 840)', [('m-blue', 110, 300, 0), ('m-orange', 1800, 300, 0)], cue('hold', 'start', 5.0)),
        ('Hop 1 at its top, carried halfway', [('m-blue', 110 + 590 * 0.5, 300, 0), ('m-orange', 1800, 300, 0)], hops[0] + 0.325),
        ('S15 at 400: (1290, 840), (1610, 840)', [('m-blue', 1290, 400, 0), ('m-orange', 1610, 400, 0)], end_o - 1.0),
    ]
    tw = (W - PAD * (len(scenes) + 1)) // len(scenes)
    th = round(tw * 1080 / 1920)
    full = []
    for i, (lab, hosts, t) in enumerate(scenes):
        frame = Image.new('RGBA', (1920, 1080), (13, 17, 23, 255))
        fd = ImageDraw.Draw(frame)
        fd.line([(0, 840), (1920, 840)], fill=(88, 166, 255, 255), width=2)
        for pid, fx, S, dx in hosts:
            img, root, _ = grab(pid, t)
            place(frame, img, root, fx, S, dx)
        full.append(frame)
        x = PAD + i * (tw + PAD)
        sheet.paste(frame.convert('RGB').resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x, y + th + 4), f'{lab} · {t:.2f}', font=f_s, fill=INK2)
    y += place_h
    # the feet on the line at full size: 1:1 crops of the placed frames round each feet point
    d.text((PAD, y + 4), 'The feet on y 840 at 1:1 (the blue line is y 840)', font=f_h, fill=INK)
    y += 36
    crops = [(0, 230, 'S1 Merc, 420'), (0, 1690, 'S1 Tavi, 420, mirrored'), (1, 110, 'Corner Merc, 300'),
             (1, 1800, 'Corner Tavi, 300, mirrored'), (3, 1290, 'S15 Merc, 400'), (3, 1610, 'S15 Tavi, 400, mirrored')]
    cw = (W - PAD * (len(crops) + 1)) // len(crops)
    for i, (k, fx, lab) in enumerate(crops):
        x = PAD + i * (cw + PAD)
        box = (fx - cw // 2, 840 - 220, fx - cw // 2 + cw, 840 + 70)
        sheet.paste(full[k].convert('RGB').crop(box), (x, y))
        d.text((x, y + 294), lab, font=f_s, fill=INK2)
    y += zoom_h
    d.text((PAD, y), 'Stills decoded from assets/merc/*.webm (30 fps scratch passes), over #0d1117; generated by tools/merc-sheet.py',
           font=f_s, fill=INK2)
    os.makedirs(os.path.join(ROOT, 'review', 'merc'), exist_ok=True)
    out = os.path.join(ROOT, 'review', 'merc', 'contact-sheet.png')
    sheet.crop((0, 0, W, y + 24)).save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    main()
