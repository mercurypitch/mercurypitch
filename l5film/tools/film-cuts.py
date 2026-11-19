"""Every cut of a whole-film render, measured: the last frame before each scene start in
assets/scenes.js and the first frame after it, their difference outside the hosts' boxes, and the
hosts' boxes on their own. A matched cut also gets the carried object's best whole-pixel shift.

  python3 tools/film-cuts.py renders/film-draft-01.mp4 --out review/film-01/cuts

Frame k of the film shows film time k / fps, so the first frame after a cut at t is ceil(t * fps)
and the last before it is that less one. Frames k-2 .. k+1 of every cut are dumped; the
step k-2 -> k-1 is the scene's own motion just before the cut, the baseline the cut is read against.
Each cut's four frames come from a short decode after a seek, picked by their own timestamps.

A pixel "changes" when its luma moves by more than CHANGED (24 of 255, measure.py's --changed). The
hosts' boxes are HANDOFFS § Shared formulas, Hosts: the body box with its 20 px keep-out, run down to
the frame's foot so the floor reflection is inside it. Changed regions are 16 px cells where more than
1 % of the pixels change, joined into boxes; a region the baseline does not have is "new at the cut".

Writes cut-NN.png (before, after, the cut's change, the baseline's change, hosts' boxes outlined),
cuts.json and cuts.md. If notes.json is in --out ({"NN": "text"}), its notes go into the table.
Uses ffmpeg, numpy and PIL (the system python3).
"""
import argparse
import json
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = os.path.join(ROOT, 'assets/fonts/Outfit-wght.ttf')
W, H = 1920, 1080
CHANGED = 24
CELL = 16
KEEP = 20

# HANDOFFS § Shared formulas, Hosts: (feet x, feet y, size) of each host on screen at each cut,
# keyed by the scene the cut enters. Body box: 0.53 of the size wide, 0.64 tall, on the feet point.
CORNERS = [('Merc', 110, 840, 300), ('Tavi', 1800, 840, 300)]
SMALL = [('Merc', 100, 840, 240), ('Tavi', 1820, 840, 240)]
RIGHT = [('Merc', 1290, 840, 300), ('Tavi', 1800, 840, 300)]
HOSTS = {
    's02-title': [],                                   # S1h's slides end before the cut
    's03-promise': [],
    's04-recall': [('Tavi', 1800, 840, 300)],          # Merc leaps in later, in S4
    's05-push': CORNERS,
    's06-diaphragm': CORNERS,
    's07-support': SMALL,
    's08-breathe': SMALL,
    's09-onset': SMALL,
    's10-steady': SMALL,
    's11-sing': CORNERS,
    's12-your-turn': CORNERS,
    's13-recap': CORNERS,
    's14-next': RIGHT,                                 # Merc on the right since hop 2
    's15-end': RIGHT,                                  # the moves to 400 start after the cut
}
# HANDOFFS § The cuts: the three matched cuts and the carried object's screen box (x0, y0, x1, y1).
MATCHED = {
    's07-support': [('the Loud gauge, the small band, chips and labels', (730, 135, 1790, 790)),
                    ("the figure's torso", (300, 180, 570, 820))],
    's11-sing': [('the empty hold frame', (990, 200, 1650, 290))],
    's13-recap': [("the frame's band and Merc's line", (920, 95, 1830, 210))],
}


def scenes():
    src = open(os.path.join(ROOT, 'assets/scenes.js')).read()
    table = json.loads(src[src.index('=') + 1:].strip().rstrip(';'))
    return sorted(table.items(), key=lambda kv: kv[1]['start'])


def host_boxes(hosts):
    out = []
    for name, x, y, size in hosts:
        half, tall = 0.53 * size / 2, 0.64 * size
        out.append((name, (int(x - half - KEEP), int(y - tall - KEEP), int(x + half + KEEP), H)))
    return out


def dump(film, first, frames_dir, fps):
    """Frames first-2 .. first+1, picked by their own timestamps after a seek (the seek keeps the
    timestamps, so frame k is the one at k / fps whatever keyframe the decode starts from)."""
    os.makedirs(frames_dir, exist_ok=True)
    ks = [first + o for o in (-2, -1, 0, 1)]
    if all(os.path.exists(os.path.join(frames_dir, f'f{k:06d}.png')) for k in ks):
        return
    tmp = os.path.join(frames_dir, 'tmp')
    os.makedirs(tmp, exist_ok=True)
    for name in os.listdir(tmp):
        os.remove(os.path.join(tmp, name))
    lo, hi = (ks[0] - 0.5) / fps, (ks[-1] + 0.5) / fps
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', f'{max(lo - 2.0, 0):.4f}', '-copyts', '-i', film,
                    '-vf', f"select='between(t\\,{lo:.5f}\\,{hi:.5f})'", '-fps_mode', 'passthrough',
                    '-frames:v', '4', os.path.join(tmp, 'o%d.png')], check=True)
    outs = sorted(os.listdir(tmp), key=lambda s: int(s[1:-4]))
    if len(outs) != 4:
        raise SystemExit(f'frames {ks[0]}..{ks[-1]}: got {len(outs)} of 4')
    for k, name in zip(ks, outs):
        os.replace(os.path.join(tmp, name), os.path.join(frames_dir, f'f{k:06d}.png'))
    os.rmdir(tmp)


def load(frames_dir, k):
    return np.asarray(Image.open(os.path.join(frames_dir, f'f{k:06d}.png')).convert('RGB'))


def luma(rgb):
    f = rgb.astype(np.float32)
    return 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]


def regions(changed, outside):
    """16 px cells where more than 1 % of the pixels change, joined 8-way into boxes."""
    gh, gw = H // CELL, W // CELL
    c = (changed & outside)[:gh * CELL, :gw * CELL].reshape(gh, CELL, gw, CELL).mean(axis=(1, 3))
    hot = c > 0.01
    seen = np.zeros_like(hot)
    boxes = []
    for j in range(gh):
        for i in range(gw):
            if not hot[j, i] or seen[j, i]:
                continue
            stack, cells = [(j, i)], []
            seen[j, i] = True
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < gh and 0 <= xx < gw and hot[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            stack.append((yy, xx))
            ys, xs = [p[0] for p in cells], [p[1] for p in cells]
            boxes.append({'box': [min(xs) * CELL, min(ys) * CELL, (max(xs) + 1) * CELL,
                                  (max(ys) + 1) * CELL], 'cells': len(cells)})
    return sorted(boxes, key=lambda b: -b['cells']), hot


def stats(diff, mask):
    if not mask.any():
        return {'mean': 0.0, 'share': 0.0, 'max': 0}
    d = diff[mask]
    return {'mean': round(float(d.mean()), 3), 'share': round(float((d > CHANGED).mean()), 5),
            'max': int(d.max())}


def edges(y):
    gx = np.zeros_like(y)
    gy = np.zeros_like(y)
    gx[:, 1:-1] = y[:, 2:] - y[:, :-2]
    gy[1:-1, :] = y[2:, :] - y[:-2, :]
    return np.hypot(gx, gy)


def best_shift(before, after, box, keep, reach=4):
    """The whole-pixel shift of after's box that best matches before's (on edges), the sub-pixel
    move of the centroid of what is drawn in the box (luma over the box's median), and the luma
    change in place."""
    x0, y0, x1, y1 = box
    eb, ea = edges(before), edges(after)
    m = keep[y0:y1, x0:x1]
    scores = {}
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            a = ea[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            b = eb[y0:y1, x0:x1]
            scores[(dx, dy)] = float(np.abs(a - b)[m].mean())
    (dx, dy), score = min(scores.items(), key=lambda kv: kv[1])
    lum = np.abs(after[y0:y1, x0:x1] - before[y0:y1, x0:x1])[m]
    ys, xs = np.mgrid[y0:y1, x0:x1]

    def centroid(lum):
        e = lum[y0:y1, x0:x1]
        e = np.clip(e - np.median(e[m]) - 8, 0, None) * m
        return float((e * xs).sum() / e.sum()), float((e * ys).sum() / e.sum())

    (bx, by), (ax, ay) = centroid(before), centroid(after)
    return {'shift': [dx, dy], 'centroid_shift': [round(ax - bx, 2), round(ay - by, 2)],
            'edge_residual': round(score, 3),
            'edge_residual_at_0': round(scores[(0, 0)], 3),
            'edge_next_best': round(sorted(scores.values())[1], 3),
            'luma_mean_at_0': round(float(lum.mean()), 3),
            'luma_share_at_0': round(float((lum > CHANGED).mean()), 5),
            'luma_max_at_0': int(lum.max())}


def panel(path, title, before, after, dcut, dbase, boxes, cut_regions, objs):
    font = ImageFont.truetype(FONT, 22) if os.path.exists(FONT) else ImageFont.load_default()
    half = (W // 2, H // 2)

    def heat(d):
        v = np.clip(d * 4, 0, 255).astype(np.uint8)
        return Image.fromarray(np.stack([v, v, v], -1))

    tiles = [Image.fromarray(before), Image.fromarray(after), heat(dcut), heat(dbase)]
    names = ['last frame before', 'first frame after', 'cut: |after - before| x4',
             'baseline: the step before, x4']
    sheet = Image.new('RGB', (W, H + 40), (13, 17, 23))
    d = ImageDraw.Draw(sheet)
    d.text((12, 8), title, fill=(230, 237, 243), font=font)
    for n, (tile, name) in enumerate(zip(tiles, names)):
        im = tile.copy()
        dd = ImageDraw.Draw(im)
        for _, b in boxes:
            dd.rectangle(b, outline=(80, 160, 255), width=4)
        if n == 2:
            for r in cut_regions:
                dd.rectangle(r['box'], outline=(255, 170, 40), width=4)
        for b in objs:
            dd.rectangle(b, outline=(90, 220, 120), width=4)
        im = im.resize(half, Image.BILINEAR)
        ox, oy = (n % 2) * half[0], 40 + (n // 2) * half[1]
        sheet.paste(im, (ox, oy))
        d.text((ox + 10, oy + 8), name, fill=(255, 255, 255), font=font,
               stroke_width=3, stroke_fill=(0, 0, 0))
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('film')
    ap.add_argument('--out', required=True)
    ap.add_argument('--fps', type=float, default=30.0)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    frames_dir = os.path.join(args.out, 'frames')
    table = scenes()
    cuts = []
    for (prev, _), (sid, s) in zip(table, table[1:]):
        k = math.ceil(s['start'] * args.fps - 1e-6)
        cuts.append({'from': prev, 'to': sid, 't': s['start'], 'first': k})
    for c in cuts:
        dump(args.film, c['first'], frames_dir, args.fps)
    notes_path = os.path.join(args.out, 'notes.json')
    notes = json.load(open(notes_path)) if os.path.exists(notes_path) else {}

    for n, c in enumerate(cuts, 1):
        k = c['first']
        rgb = {o: load(frames_dir, k + o) for o in (-2, -1, 0, 1)}
        y = {o: luma(v) for o, v in rgb.items()}
        boxes = host_boxes(HOSTS[c['to']])
        inside = np.zeros((H, W), bool)
        for _, (x0, y0, x1, y1) in boxes:
            inside[max(y0, 0):y1, max(x0, 0):x1] = True
        outside = ~inside
        dcut, dbase, dnext = (np.abs(y[0] - y[-1]), np.abs(y[-1] - y[-2]), np.abs(y[1] - y[0]))
        reg_cut, hot_cut = regions(dcut > CHANGED, outside)
        _, hot_base = regions(dbase > CHANGED, outside)
        _, hot_next = regions(dnext > CHANGED, outside)
        new = hot_cut & ~hot_base & ~hot_next
        for r in reg_cut:
            x0, y0, x1, y1 = (v // CELL for v in r['box'])
            r['new_at_cut'] = bool(new[y0:y1, x0:x1].any())
        c.update({
            'n': n, 'last_before': k - 1, 't_last': round((k - 1) / args.fps, 4),
            't_first': round(k / args.fps, 4),
            'hosts': [{'name': nm, 'box': list(b)} for nm, b in boxes],
            'outside': stats(dcut, outside), 'outside_baseline': stats(dbase, outside),
            'outside_after': stats(dnext, outside),
            'outside_new_cells': int(new.sum()),
            'inside': {nm: stats(dcut, _box(b)) for nm, b in boxes},
            'inside_baseline': {nm: stats(dbase, _box(b)) for nm, b in boxes},
            'inside_after': {nm: stats(dnext, _box(b)) for nm, b in boxes},
            'regions': reg_cut[:8],
            'note': notes.get(f'{n:02d}', ''),
        })
        objs = MATCHED.get(c['to'], [])
        if objs:
            c['matched'] = [{'object': what, 'box': list(b), **best_shift(y[-1], y[0], b, outside)}
                            for what, b in objs]
        title = (f"cut {n:02d}  {c['from']} -> {c['to']}  at {c['t']:.3f} s: frames {k - 1} "
                 f"({(k - 1) / args.fps:.3f}) | {k} ({k / args.fps:.3f})")
        panel(os.path.join(args.out, f'cut-{n:02d}.png'), title, rgb[-1], rgb[0], dcut, dbase,
              boxes, reg_cut[:8], [b for _, b in objs])

    json.dump(cuts, open(os.path.join(args.out, 'cuts.json'), 'w'), indent=1)
    lines = ['# The cuts of film-draft-01', '',
             f'Luma change in 0-255; "share" is the part of the pixels changing by more than '
             f'{CHANGED}. Outside = the frame less the hosts\' boxes (body box, {KEEP} px keep-out, '
             'down to the frame\'s foot). Baseline = the same measure one frame earlier, inside the '
             'outgoing scene. New cells = 16 px cells that change at the cut and in neither '
             'neighbouring step. Matched: the carried object\'s best whole-pixel shift (edges, '
             'within 4 px), the move of the centroid of what is drawn there (sub-pixel), and its luma change in '
             'place (mean / share).', '',
             '| # | Cut | t (s) | Frames | Outside: mean / share / new cells | Baseline outside '
             '| Hosts\' boxes: mean at the cut (the step before, the step after) '
             '| Matched: whole-px shift, centroid move, luma in place | Note |',
             '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for c in cuts:
        o, b = c['outside'], c['outside_baseline']
        hosts = '; '.join(f"{nm} {c['inside'][nm]['mean']:.2f} ({c['inside_baseline'][nm]['mean']:.2f}, "
                          f"{c['inside_after'][nm]['mean']:.2f})"
                          for nm in c['inside']) or 'none on screen'
        mt = '; '.join(f"{m['object']}: ({m['shift'][0]}, {m['shift'][1]}), centroid "
                       f"({m['centroid_shift'][0]:+.2f}, {m['centroid_shift'][1]:+.2f}) px, luma "
                       f"{m['luma_mean_at_0']:.2f} / {m['luma_share_at_0']:.2%}"
                       for m in c.get('matched', [])) or 'plain'
        lines.append(f"| {c['n']} | {c['from']} -> {c['to']} | {c['t']:.3f} | "
                     f"{c['last_before']} / {c['first']} | {o['mean']:.2f} / {o['share']:.2%} / "
                     f"{c['outside_new_cells']} | {b['mean']:.2f} / {b['share']:.2%} | {hosts} | "
                     f"{mt} | {c['note']} |")
    lines.append('')
    open(os.path.join(args.out, 'cuts.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


def _box(b):
    m = np.zeros((H, W), bool)
    x0, y0, x1, y1 = b
    m[max(y0, 0):y1, max(x0, 0):x1] = True
    return m


if __name__ == '__main__':
    main()
