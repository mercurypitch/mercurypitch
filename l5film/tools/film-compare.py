"""One whole-film draft against another: holds, single-frame events, the critic's collisions, Merc
through the clean break's hops, and loudness.

  python3 tools/film-compare.py --a renders/film-draft-01.mp4 --a-measure review/film-01-measure \\
      --b renders/film-draft-02.mp4 --b-measure review/film-02-measure --out review/film-02

Reads each draft's measure.py output (motion.csv, summary.md) and tools/film-events.py's events.md,
cues.json and assets/scenes.js. Writes OUT/COMPARE.md and OUT/compare/ (the collision crops, Merc's
track as CSV). Descriptions of new events come from OUT/compare/notes.json ({"<t>": "text"}) when
present (and notes on a draft-A event under "a:<t>"); otherwise the event is placed in the hosts' boxes
or named by its boxes.

Holds are measure.py's: a 0.1 s sample with mean change under 0.1 and no pixel changing by 16 or
more; the hold that runs to the film's end is left out. An event of draft A is "still there" when
draft B has one within a frame of it, "moved" when B has one within 1 s whose boxes meet A's
(within 32 px), and "gone" otherwise; a B event no A event claims is new.

Collisions: on every frame of each window, the ink of the two things the critic named (by colour
and place, below) and the nearest distance between them in px; "apart" when one is not drawn.
Merc's box: his body's pixels (blue over red by 40, brightest channel over 150) from y 690 to 842
(below the recap's chart, above the floor), the 260 px run of columns that holds most of them;
its centre is the middle of that run's ink, its foot the lowest ink row.
Uses ffmpeg, numpy and PIL (the system python3).
"""
import argparse
import csv
import importlib.util
import json
import math
import os
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location('film_cuts', os.path.join(HERE, 'film-cuts.py'))
fc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fc)
CUES = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
FPS = 30.0
FREEZE, NOISE = 0.1, 16
TYPE_STEPS = [6.27, 10.80, 13.93, 17.80, 19.73, 24.27, 27.87, 33.03, 40.17, 40.70, 55.27, 55.67,
              326.93, 410.13, 411.07, 471.27, 525.23, 526.50, 543.03]   # DECISIONS 233
HOPS = (490.31, 491.62)
SETTLE = 491.95    # the track runs on past hop 2's landing to show its settle

# ---------------------------------------------------------------- holds


def samples(measure):
    return [(float(r['t']), float(r['mean_change']), float(r['largest_change']))
            for r in csv.DictReader(open(os.path.join(measure, 'motion.csv')))]


def hold_runs(smp):
    step = round(smp[1][0] - smp[0][0], 4)
    runs, cur = [], []
    for s in smp + [None]:
        if s is not None and s[1] < FREEZE and s[2] < NOISE:
            cur.append(s)
            continue
        if cur:
            runs.append((round(cur[0][0] - step, 3), round(len(cur) * step, 3)))
            cur = []
    ending = smp[-1][0]
    return [r for r in runs if r[0] + r[1] < ending - 0.05]


def overlap(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def words_around(s, e):
    """Inside a word when 0.1 s (one sample) or more of the hold lies in it; else the words either side."""
    words = sorted((w[1], w[2], w[0], cid) for cid, c in CUES.items() for w in c.get('words', []))
    inside = [(min(b, e) - max(a, s), w, cid, a) for a, b, w, cid in words if min(b, e) - max(a, s) >= 0.1 - 1e-6]
    if inside:
        return 'inside ' + ', '.join(f'"{w}" ({cid} {a:.2f}, {o:.2f} s of it)' for o, w, cid, a in inside)
    before = [x for x in words if x[0] < s + 0.05]
    after = [x for x in words if x[0] >= s + 0.05]
    mid = (s + e) / 2
    gap = [cid for cid, c in CUES.items() if c['type'] in ('pause', 'mark', 'sound') and
           c['start'] <= mid <= c['end'] + 1e-6 and c['dur'] > 0]
    parts = []
    if before:
        a, b, w, cid = before[-1]
        parts.append(f'after "{w}" ({cid}, ends {b:.2f})')
    if after:
        a, b, w, cid = after[0]
        parts.append(f'before "{w}" ({cid}, {a:.2f})')
    if gap:
        parts.append('in ' + ', '.join(f'`{g}` ({CUES[g]["type"]})' for g in gap))
    return '; '.join(parts)


# ---------------------------------------------------------------- events


def read_events(measure):
    rows = []
    for line in open(os.path.join(measure, 'events.md')):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) < 8 or not cells[0].isdigit():
            continue
        boxes = []
        for b in cells[7].split(';'):
            m = re.match(r'\s*(\d+),(\d+)-(\d+),(\d+)', b)
            if m:
                boxes.append(tuple(int(v) for v in m.groups()))
        rows.append({'n': int(cells[0]), 't': float(cells[1]), 'frame': int(cells[2]),
                     'kind': cells[3], 'pixels': cells[4], 'scene': cells[5], 'near': cells[6],
                     'boxes': boxes})
    return rows


def boxes_meet(a, b, reach=32):
    return any(x0 - reach < X1 and X0 < x1 + reach and y0 - reach < Y1 and Y0 < y1 + reach
               for x0, y0, x1, y1 in a for X0, Y0, X1, Y1 in b)


def match(ea, eb):
    """Still there first (a B event within a frame), then moved (an unclaimed B event within 1 s whose
    boxes meet the A event's main box within 32 px)."""
    used, out = set(), [None] * len(ea)
    for i, e in enumerate(ea):
        same = [x for x in eb if abs(x['frame'] - e['frame']) <= 1]
        if same:
            out[i] = ('still there', same[0])
            used.update(id(x) for x in same)
    for i, e in enumerate(ea):
        if out[i]:
            continue
        near = sorted((x for x in eb if id(x) not in used and abs(x['t'] - e['t']) <= 1.0
                       and boxes_meet(e['boxes'][:1], x['boxes'])), key=lambda x: abs(x['t'] - e['t']))
        if near:
            out[i] = ('moved', near[0])
            used.add(id(near[0]))
        else:
            out[i] = ('gone', None)
    return out, [x for x in eb if id(x) not in used]


def host_regions(t):
    """The hosts' boxes (HANDOFFS § Hosts) with their 20 px keep-out, down to the frame's foot."""
    def box(x, size):
        half, tall = 0.53 * size / 2 + 20, 0.64 * size + 20
        return (x - half, 840 - tall, x + half, 1080)
    out = []
    if t < 38.4:
        out += [box(230, 420), box(1690, 420)]
        if t >= 37.7:
            out += [(0, 551, 380, 1080), (1540, 551, 1920, 1080)]
    if 52.0 <= t:
        out.append(box(1800, 300))
    if 58.5 <= t:
        out.append(box(110, 300))
    if 102.72 <= t < 346.42:
        out += [box(100, 240), box(1820, 240)]
    if 490.2 <= t <= 491.7:
        out.append((10, 600, 1390, 1080))
    if t >= 490.2:
        out.append(box(1290, 300))
    if t >= 543.2:
        out += [box(1290, 400), box(1610, 400)]
    return out


def in_hosts(e):
    regs = host_regions(e['t'])
    return bool(e['boxes']) and all(
        any(r[0] - 8 <= (b[0] + b[2]) / 2 <= r[2] + 8 and r[1] - 8 <= (b[1] + b[3]) / 2 <= r[3] + 8
            for r in regs) for b in e['boxes'])


# ---------------------------------------------------------------- frames


def frames(film, t0, t1, crop=None):
    """Every frame k with t0 <= k / FPS <= t1, as {k: RGB array}."""
    k0, k1 = math.ceil(t0 * FPS - 1e-6), math.floor(t1 * FPS + 1e-6)
    tmp = os.path.join(ROOT, 'lab', 'integration', '.compare-frames')
    os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    vf = f"select='between(t\\,{(k0 - 0.5) / FPS:.5f}\\,{(k1 + 0.5) / FPS:.5f})'"
    if crop:
        vf += f',crop={crop[2] - crop[0]}:{crop[3] - crop[1]}:{crop[0]}:{crop[1]}'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{max(t0 - 2, 0):.3f}',
                    '-copyts', '-i', film, '-vf', vf, '-fps_mode', 'passthrough',
                    os.path.join(tmp, 'f%05d.png')], check=True)
    names = sorted(os.listdir(tmp))
    if len(names) != k1 - k0 + 1:
        raise SystemExit(f'{film} {t0}-{t1}: {len(names)} frames, wanted {k1 - k0 + 1}')
    out = {k0 + i: np.asarray(Image.open(os.path.join(tmp, n)).convert('RGB')).astype(np.int16)
           for i, n in enumerate(names)}
    for n in names:
        os.remove(os.path.join(tmp, n))
    return out


# ---------------------------------------------------------------- Merc


def merc_box(rgb):
    """Merc's box from a frame cropped to y 690-842 (see the docstring): (centre x, foot y) or None."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = (b > r + 40) & (rgb.max(-1) > 150)
    ys, xs = np.where(m)
    if len(xs) < 500:
        return None
    hist = np.bincount(xs, minlength=rgb.shape[1])
    cs = np.concatenate([[0], np.cumsum(hist)])
    w = 260
    x = int(np.argmax(cs[w:] - cs[:-w]))
    sel = (xs >= x) & (xs < x + w)
    return (xs[sel].min() + xs[sel].max()) / 2, int(ys[sel].max()) + 690


def merc_track(film):
    fr = frames(film, HOPS[0] - 1 / FPS, SETTLE, crop=(0, 690, 1600, 843))
    return {k: merc_box(v) for k, v in fr.items()}


# ---------------------------------------------------------------- collisions


def neutral(rgb, lo):
    """Light, unsaturated ink (type, outlines): brightest channel over `lo`, spread under a quarter of it."""
    mx, mn = rgb.max(-1), rgb.min(-1)
    return (mx > lo) & (mx - mn < 0.25 * mx + 10)


def amber(rgb):
    """The band's fill and edge: red over blue by 12, green over blue by 6, red 32 or more."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r - b >= 12) & (g - b >= 6) & (r >= 32)


def orange_line(rgb):
    """Merc's line and the band's centre line: bright orange."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 180) & (g > 90) & (b < 90) & (r > g + 50)


def teal(rgb):
    """The chapter number's teal, at any strength: green over red by 25, blue over red by 15."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (g - r > 25) & (b - r > 15) & (g > 45)


def region(mask, box):
    out = np.zeros_like(mask)
    x0, y0, x1, y1 = box
    out[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    return out


def solid(mask, need=4):
    """The mask less specks: a pixel stays when its 5x5 neighbourhood holds `need` or more ink pixels."""
    c = np.pad(mask.astype(np.int32), 2).cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    h, w = mask.shape
    n = c[5:5 + h, 5:5 + w] - c[:h, 5:5 + w] - c[5:5 + h, :w] + c[:h, :w]
    return mask & (n >= need)


def big(mask, min_px=60):
    """The mask's 8-connected pieces of `min_px` pixels or more (drops the room's dust)."""
    ys, xs = np.where(mask)
    keep = np.zeros_like(mask)
    seen = set()
    on = set(zip(ys.tolist(), xs.tolist()))
    for p in on:
        if p in seen:
            continue
        stack, piece = [p], []
        seen.add(p)
        while stack:
            y, x = stack.pop()
            piece.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (y + dy, x + dx)
                    if q in on and q not in seen:
                        seen.add(q)
                        stack.append(q)
        if len(piece) >= min_px:
            py, px = zip(*piece)
            keep[list(py), list(px)] = True
    return keep


def edge(mask):
    """The mask's pixels with a 4-neighbour outside it."""
    p = np.pad(mask, 1)
    inner = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return mask & ~inner


def nearest(a, b, floor=40):
    """Nearest distance in px between two ink masks, specks left out (None when either has under
    `floor` pixels)."""
    a, b = solid(a), solid(b)
    if a.sum() < floor or b.sum() < floor:
        return None
    if (a & b).any():
        return 0.0
    a, b = edge(a), edge(b)     # the nearest pair of two apart inks lies on their edges
    ay, ax = np.where(a)
    by, bx = np.where(b)
    if len(ax) > 6000:
        i = np.linspace(0, len(ax) - 1, 6000).astype(int)
        ay, ax = ay[i], ax[i]
    best = math.inf
    for s in range(0, len(bx), 2000):
        d = (ax[:, None] - bx[None, s:s + 2000]) ** 2 + (ay[:, None] - by[None, s:s + 2000]) ** 2
        best = min(best, float(d.min()))
    return math.sqrt(best)


# (name, (the critic's window, widened before and after: only where nothing else of the scene
# takes the inks' colours and places), crop box for the picture, the two inks: label, mask function)
A3_BOX = (330, 362, 480, 430)   # S3's "A3" as it fades up, below the title's lowest ink

COLLISIONS = [
    ('"support" against the band (S1)', (32.1, 33.5, 0.0, 0.5), (300, 150, 1460, 660),
     ('"support"', lambda f: region(neutral(f, 150), (480, 150, 1460, 470))),
     ('the band', lambda f: region(amber(f), (300, 370, 1460, 660)))),
    ('S2\'s title against "A3" and the band', (41.5, 41.6, 0.15, 0.1), (250, 100, 1650, 720),
     ('the title', lambda f: big(region(neutral(f, 45), (300, 100, 1600, 400)) &
                                 ~region(np.ones(f.shape[:2], bool), A3_BOX), 150)),
     ('"A3" and the band', lambda f: big(region(neutral(f, 45), A3_BOX) | region(amber(f), (440, 250, 1600, 560)), 30))),
    ('S4\'s chips against the band\'s line', (65.43, 65.57, 0.5, 0.5), (0, 0, 1920, 420),
     ('the chips', lambda f: region(neutral(f, 90), (1050, 0, 1920, 300))),
     ('the band\'s line', lambda f: region(orange_line(f), (0, 0, 1920, 400)))),
    ('S8\'s "03" against the parked figure', (209.5, 210.1, 0.5, 0.5), (100, 120, 800, 620),
     ('"03"', lambda f: region(teal(f), (380, 150, 760, 560))),
     ('the figure', lambda f: big(region(neutral(f, 50) & (f[..., 1] - f[..., 0] <= 15) & (f[..., 2] - f[..., 0] < 22),
                                         (100, 150, 640, 640))))),
]


def collision(film, window, ink_a, ink_b):
    fr = frames(film, *window)
    rows = []
    for k, f in sorted(fr.items()):
        a, b = ink_a[1](f), ink_b[1](f)
        rows.append((k, nearest(a, b), int(a.sum()), int(b.sum())))
    return rows, fr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', required=True)
    ap.add_argument('--a-measure', required=True)
    ap.add_argument('--b', required=True)
    ap.add_argument('--b-measure', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', default='', help='comma list of sections to recompute: holds,events,collisions,hops')
    args = ap.parse_args()
    cdir = os.path.join(args.out, 'compare')
    os.makedirs(cdir, exist_ok=True)
    na, nb = 'draft-01', 'draft-02'
    table = fc.scenes()
    total = table[-1][1]['end']
    notes_path = os.path.join(cdir, 'notes.json')
    notes = json.load(open(notes_path)) if os.path.exists(notes_path) else {}
    L = ['# film-draft-01 against film-draft-02', '']

    def probe(film):
        out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets',
                              '-show_entries', 'stream=nb_read_packets:format=duration', '-of', 'json',
                              film], capture_output=True, text=True).stdout
        d = json.loads(out)
        return float(d['format']['duration']), int(d['streams'][0]['nb_read_packets'])

    (da, fa), (db, fb) = probe(args.a), probe(args.b)
    L += [f'{na}: `{args.a}`, {da:.3f} s, {fa} frames. {nb}: `{args.b}`, {db:.3f} s, {fb} frames.', '']

    # ---- holds
    ra, rb = hold_runs(samples(args.a_measure)), hold_runs(samples(args.b_measure))

    def film_line(runs):
        tot = sum(l for _, l in runs)
        s, l = max(runs, key=lambda r: r[1]) if runs else (0, 0)
        return tot, tot * 30 / total, (s, l)

    ta, tb = film_line(ra), film_line(rb)
    L += ['## Holds', '',
          'measure.py\'s hard holds (a 0.1 s sample with mean change under 0.1 and no pixel changing '
          'by 16 or more), the final hold left out. Target: about 1 s per 30 s, none over about 0.5 s.', '',
          f'| | {na} | {nb} |', '| --- | --- | --- |',
          f'| Held in the film | {ta[0]:.1f} s | {tb[0]:.1f} s |',
          f'| Per 30 s | {ta[1]:.2f} s | {tb[1]:.2f} s |',
          f'| Longest | {ta[2][1]:.1f} s at {ta[2][0]:.2f} | {tb[2][1]:.1f} s at {tb[2][0]:.2f} |', '',
          '**Per 30 s of the film**', '', f'| Window | {na} | {nb} |', '| --- | --- | --- |']
    for w in range(math.ceil(total / 30)):
        lo, hi = w * 30, min((w + 1) * 30, total)
        ha = sum(overlap(s, s + l, lo, hi) for s, l in ra)
        hb = sum(overlap(s, s + l, lo, hi) for s, l in rb)
        L.append(f'| {lo:.0f}-{hi:.0f} s | {ha:.1f} s | {hb:.1f} s |')
    L += ['', '**Per scene** (held seconds, per 30 s of the scene, the longest and where)', '',
          f'| Scene | Length | {na} held | per 30 s | longest | {nb} held | per 30 s | longest |',
          '| --- | --- | --- | --- | --- | --- | --- | --- |']
    for sid, s in table:
        a0, a1 = s['start'], s['end']
        cells = []
        for runs in (ra, rb):
            held = sum(overlap(x, x + l, a0, a1) for x, l in runs)
            mine = [(x, l) for x, l in runs if overlap(x, x + l, a0, a1) > 0]
            lg = max(mine, key=lambda r: r[1]) if mine else None
            cells += [f'{held:.1f} s', f'{held * 30 / (a1 - a0):.2f} s',
                      f'{lg[1]:.1f} s at {lg[0]:.2f}' if lg else '-']
        L.append(f'| {sid} | {a1 - a0:.2f} s | ' + ' | '.join(cells) + ' |')
    long_b = [(s, l) for s, l in rb if l >= 0.3 - 1e-6]
    L += ['', f'**Every hold of 0.3 s or more in {nb}** ({len(long_b)})', '',
          '| Starts | Length | Scene + s | The words around it |', '| --- | --- | --- | --- |']
    for s, l in long_b:
        sid = next((i for i, x in table if x['start'] <= s < x['end']), table[-1][0])
        off = s - dict(table)[sid]['start']
        L.append(f'| {s:.2f} | {l:.1f} s | {sid} +{off:.2f} | {words_around(s, s + l)} |')
    L.append('')

    # ---- events
    ea, eb = read_events(args.a_measure), read_events(args.b_measure)
    res, new = match(ea, eb)
    kinds = lambda ev: ', '.join(f'{k} {sum(1 for e in ev if e["kind"] == k)}' for k in ('jump', 'pop'))
    count = lambda st: sum(1 for s, _ in res if s == st)
    L += ['## Single-frame events', '',
          f'{na}: {len(ea)} ({kinds(ea)}). {nb}: {len(eb)} ({kinds(eb)}). Of {na}\'s events, '
          f'{count("gone")} are gone, {count("moved")} moved and {count("still there")} still there; '
          f'{len(new)} are new in {nb}.', '',
          'Still there: a draft-02 event within a frame. Moved: one within 1 s whose boxes meet '
          'within 32 px. Gone: neither.', '',
          '**The type steps of DECISIONS 233**', '', f'| {na} | Scene | Status in {nb} |', '| --- | --- | --- |']
    by_t = {round(e['t'], 2): (e, r) for e, r in zip(ea, res)}
    for t in TYPE_STEPS:
        hit = min(by_t, key=lambda x: abs(x - t))
        e, (st, other) = by_t[hit]
        where = f" ({other['t']:.3f}, {other['kind']}, {other['pixels']})" if other else ''
        note = notes.get(f"a:{e['t']:.3f}")
        L.append(f"| {e['t']:.3f} | {e['scene']} | {st}{where}{'. ' + note if note else ''} |")
    L += ['', f'**Every {na} event**', '', f'| # | t | Kind | Scene + s | Where | Status in {nb} |',
          '| --- | --- | --- | --- | --- | --- |']
    for e, (st, other) in zip(ea, res):
        where = 'hosts' if in_hosts(e) else 'content'
        tag = f" ({other['t']:.3f})" if other and st == 'moved' else ''
        L.append(f"| {e['n']} | {e['t']:.3f} | {e['kind']} | {e['scene']} | {where} | {st}{tag} |")
    L += ['', f'**New in {nb}** ({len(new)})', '', '| t | Frame | Kind | Pixels | Scene + s | What it is |',
          '| --- | --- | --- | --- | --- | --- |']
    for e in new:
        what = notes.get(f"{e['t']:.3f}") or ('the hosts\' boxes (faces, talk rings, poses)' if in_hosts(e)
                                              else 'content at ' + '; '.join(f'{b[0]},{b[1]}-{b[2]},{b[3]}' for b in e['boxes']))
        L.append(f"| {e['t']:.3f} | {e['frame']} | {e['kind']} | {e['pixels']} | {e['scene']} | {what} |")
    L.append('')

    # ---- collisions
    L += ['## The critic\'s four collisions', '',
          'On every frame, the nearest distance in px between the two inks (picked by colour and place, '
          'dust left out; "never together" when one of them is not drawn on any frame), in the critic\'s '
          'window and in the window widened either side. The crops are the same frame from each draft: '
          'draft-02\'s nearest frame (in the window, else in the widened one), or the window\'s middle frame.', '',
          f'| Collision | Window | {na}: nearest in it | {nb}: nearest in it | {nb}: nearest, widened '
          f'| Frames both drawn in it ({na}, {nb}) | Crops |',
          '| --- | --- | --- | --- | --- | --- | --- |']
    font = ImageFont.truetype(fc.FONT, 22) if os.path.exists(fc.FONT) else ImageFont.load_default()
    coll_json = []
    fmt = lambda r: f'{r[1]:.1f} px ({r[0]}, {r[0] / FPS:.3f})' if r else 'never together'
    for i, (name, (w0, w1, before, after), crop, ink_a, ink_b) in enumerate(COLLISIONS, 1):
        wide = (w0 - before, w1 + after)
        rows_a, fr_a = collision(args.a, wide, ink_a, ink_b)
        rows_b, fr_b = collision(args.b, wide, ink_a, ink_b)
        inside = lambda rows: [r for r in rows if w0 - 1e-6 <= r[0] / FPS <= w1 + 1e-6]
        closest = lambda rows: min((r for r in rows if r[1] is not None), key=lambda r: r[1], default=None)
        near_a, near_b, wide_b = closest(inside(rows_a)), closest(inside(rows_b)), closest(rows_b)
        both = lambda rows: sum(1 for r in inside(rows) if r[1] is not None)
        mid = [r[0] for r in inside(rows_b)]
        k = (near_b or wide_b or (mid[len(mid) // 2], None))[0]
        paths = []
        for tag, fr in ((na, fr_a), (nb, fr_b)):
            x0, y0, x1, y1 = crop
            im = Image.fromarray(fr[k].astype(np.uint8)).crop((x0, y0, x1, y1))
            d = ImageDraw.Draw(im)
            d.text((10, 8), f'{tag}  frame {k}  {k / FPS:.3f} s', fill=(255, 255, 255), font=font,
                   stroke_width=3, stroke_fill=(0, 0, 0))
            p = os.path.join(cdir, f'collision-{i}-{tag}.png')
            im.save(p)
            paths.append(os.path.relpath(p, args.out))
        L.append(f'| {name} | {w0}-{w1} (widened {wide[0]:.2f}-{wide[1]:.2f}) | {fmt(near_a)} | {fmt(near_b)} | '
                 f'{fmt(wide_b)} | {both(rows_a)} and {both(rows_b)} of {len(inside(rows_b))} | '
                 f'{", ".join(f"`{p}`" for p in paths)} |')
        coll_json.append({'name': name, 'window': [w0, w1], 'widened': wide, 'a': rows_a, 'b': rows_b})
    json.dump(coll_json, open(os.path.join(cdir, 'collisions.json'), 'w'), indent=0)
    L.append('')

    # ---- Merc's hops
    tr_a, tr_b = merc_track(args.a), merc_track(args.b)
    ks = sorted(tr_b)
    with open(os.path.join(cdir, 'hops.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['frame', 't', f'{na}_x', f'{na}_foot', f'{nb}_x', f'{nb}_foot'])
        for k in ks:
            a, b = tr_a.get(k), tr_b.get(k)
            w.writerow([k, f'{k / FPS:.3f}', f'{a[0]:.1f}' if a else '', a[1] if a else '',
                        f'{b[0]:.1f}' if b else '', b[1] if b else ''])

    def hop_stats(tr):
        xs = [(k, tr[k][0]) for k in ks if tr.get(k)]
        steps = [(xs[i + 1][0], xs[i + 1][1] - xs[i][1]) for i in range(len(xs) - 1)]
        big = max(steps, key=lambda s: abs(s[1]))
        # a jump: a frame off the line through its neighbours, with the steps either side opposed
        jumps = [(xs[i][0], xs[i][1] - (xs[i - 1][1] + xs[i + 1][1]) / 2)
                 for i in range(1, len(xs) - 1)
                 if (xs[i][1] - xs[i - 1][1]) * (xs[i + 1][1] - xs[i][1]) < 0
                 and min(abs(xs[i][1] - xs[i - 1][1]), abs(xs[i + 1][1] - xs[i][1])) > 6]
        stance = lambda t0, t1: [x for k, x in xs if t0 <= k / FPS <= t1]
        return big, jumps, stance(490.86, 491.06), stance(491.52, SETTLE)

    ha, hb = hop_stats(tr_a), hop_stats(tr_b)
    L += ['## Merc through the clean break\'s hops (490.31 to 491.62)', '',
          f'Merc\'s box centre (x) and foot (y) on every frame, on to {SETTLE} to cover hop 2\'s settle; every value is in '
          '`compare/hops.csv`. A jump is a frame that steps more than 6 px one way and back the next.', '',
          f'| | {na} | {nb} |', '| --- | --- | --- |']
    for lab, i in (('Largest step between frames', 0),):
        L.append(f'| {lab} | {ha[0][1]:+.1f} px into frame {ha[0][0]} ({ha[0][0] / FPS:.3f}) | '
                 f'{hb[0][1]:+.1f} px into frame {hb[0][0]} ({hb[0][0] / FPS:.3f}) |')
    jf = lambda js: '; '.join(f'frame {k} ({k / FPS:.3f}) {d:+.1f} px off its neighbours' for k, d in js) or 'none'
    L.append(f'| Frames that jump against their neighbours | {jf(ha[1])} | {jf(hb[1])} |')
    rng = lambda v: f'{min(v):.1f} to {max(v):.1f}' if v else '-'
    L.append(f'| Centre between the hops (490.86 to 491.06) | {rng(ha[2])} | {rng(hb[2])} |')
    L.append(f'| Centre after landing (491.52 to {SETTLE}) | {rng(ha[3])} | {rng(hb[3])} |')
    L += ['', '| Frame | t | ' + f'{na} x | {na} foot | {nb} x | {nb} foot | step ({nb}) |',
          '| --- | --- | --- | --- | --- | --- | --- |']
    prev = None
    for k in ks:
        a, b = tr_a.get(k), tr_b.get(k)
        step = f'{b[0] - prev:+.1f}' if b and prev is not None else ''
        L.append(f"| {k} | {k / FPS:.3f} | {a[0]:.1f} | {a[1]} | {b[0]:.1f} | {b[1]} | {step} |"
                 if a and b else f'| {k} | {k / FPS:.3f} | | | | | |')
        prev = b[0] if b else None
    L.append('')

    # ---- loudness
    def loud(measure):
        s = open(os.path.join(measure, 'summary.md')).read()
        m = re.search(r'Integrated (\S+) LUFS, loudness range (\S+) LU, true peak (\S+) dBTP', s)
        return m.groups() if m else ('?', '?', '?')

    la, lb = loud(args.a_measure), loud(args.b_measure)
    L += ['## Loudness', '', f'| | {na} | {nb} |', '| --- | --- | --- |',
          f'| Integrated | {la[0]} LUFS | {lb[0]} LUFS |', f'| Loudness range | {la[1]} LU | {lb[1]} LU |',
          f'| True peak | {la[2]} dBTP | {lb[2]} dBTP |', '']
    open(os.path.join(args.out, 'COMPARE.md'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
