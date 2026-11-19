#!/usr/bin/env python3
"""DECISIONS 227 over group E's clips: every hold measure.py lists, against the spoken words at its time (assets/cues.js,
the same clock the scenes read). A hold of 0.3 s or more inside a word is the round's concern; shorter ones, and holds
in pauses, go to the final passes (189).

  python3 lab/s13-recap/tools/holdwords.py      (from P) writes lab/<scene-id>/fix-F-01/holds.txt for the three scenes
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.normpath(os.path.join(HERE, '..', '..', '..'))


def load(js):
    src = open(os.path.join(P, 'assets', js)).read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


CUES = load('cues.js')['cues']
SCENES = load('scenes.js')

for sid in ['s13-recap', 's14-next', 's15-end']:
    s0, s1 = SCENES[sid]['start'], SCENES[sid]['end']
    words = []
    for cid, c in CUES.items():
        for w in c.get('words') or []:
            if w[2] > s0 and w[1] < s1:
                words.append((w[1] - s0, w[2] - s0, w[0], cid))
    log = open(os.path.join(P, 'lab', sid, 'measure.log')).read()
    block = log.split('## Holds', 1)[1].split('## Low motion', 1)[0]
    summary = [l for l in block.splitlines() if l.startswith('**')]
    holds = [(float(a), float(b), n.strip()) for a, b, n in re.findall(r'^\| ([\d.]+) s \| ([\d.]+) s \|([^|]*)\|', block, re.M)]
    out = [f'{sid}: measure.py\'s holds against the spoken words (scene time)', *summary, '']
    worst = []
    for a, d, note in holds:
        inside = [w for w in words if w[0] < a + d and w[1] > a]
        where = ', '.join(f'"{w[2]}" ({w[3]} {w[0]:.2f} to {w[1]:.2f})' for w in inside) or 'a pause'
        out.append(f'  {a:6.2f} s  {d:.1f} s  {where}' + (f'  [{note}]' if note else ''))
        if d >= 0.3 - 1e-9 and inside:
            worst.append((a, d, where))
    out += ['', f'{len(holds)} holds; {len(worst)} of 0.3 s or more inside a word' + (':' if worst else '.')]
    out += [f'  {a:.2f} s, {d:.1f} s: {w}' for a, d, w in worst]
    os.makedirs(os.path.join(P, 'lab', sid, 'fix-F-01'), exist_ok=True)
    open(os.path.join(P, 'lab', sid, 'fix-F-01', 'holds.txt'), 'w').write('\n'.join(out) + '\n')
    print('\n'.join(out[:3] + out[-1 - len(worst):]))
