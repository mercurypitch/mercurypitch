"""Write SCRIPT.md: the narration as a readable script with its timings, from cues.json.

  python3 tools/script-md.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
cues = json.load(open(os.path.join(ROOT, 'cues.json')))
C, total = cues['cues'], cues['total']
s = open(os.path.join(ROOT, 'assets/scenes.js')).read()
S = json.loads(s[s.index('=') + 1:].strip().rstrip(';'))
WHO = {'blue': 'MERC', 'orange': 'TAVI'}
lines = ['# Script (voiced): Find Your Pitch, Lesson 4, "The major scale and home"', '',
         f'Generated from `script.json` and `cues.json` by `tools/script-md.py`. Running time {int(total // 60)}:{int(total % 60):02d}.',
         'Times are film time (m:ss.s). Scene headings follow `assets/scenes.js`. The approved script is SCRIPT-DRAFT.md until the film documents move to docs/plans/find-your-pitch/lessons/04-major-scale/; this file is its voiced clock. Words are spelled for the voice ("doh, ray, mee");',
         'captions and the picture write them as on screen ("do, re, mi").', '']
scene_starts = sorted((v['start'], k, v['title']) for k, v in S.items())
si = 0
def mmss(t):
    return f'{int(t // 60)}:{t % 60:04.1f}'
for k, c in sorted(C.items(), key=lambda kv: kv[1]['start']):
    while si < len(scene_starts) and scene_starts[si][0] <= c['start'] + 1e-6:
        lines += ['', f'## {scene_starts[si][1]}: {scene_starts[si][2]} ({mmss(scene_starts[si][0])})', '']
        si += 1
    t = mmss(c['start'])
    if c['type'] == 'line':
        lines.append(f"- `{t}` **{WHO[c['who']]}:** {c['text']}")
    elif c['type'] == 'sing':
        lines.append(f"- `{t}` *{WHO[c['who']].title()} sings {c['note']} ({c['dur']:.1f} s).*")
    elif c['type'] == 'sound':
        lines.append(f"- `{t}` *Sound: {c['sound']} ({c['dur']:.1f} s).*")
    elif c['type'] == 'pause':
        lines.append(f"- `{t}` *Pause: {k} ({c['dur']:.1f} s).*")
    elif c['type'] == 'sting':
        lines.append(f"- `{t}` *Sting: {k}.*")
open(os.path.join(ROOT, 'SCRIPT.md'), 'w').write('\n'.join(lines) + '\n')
print('SCRIPT.md written')
