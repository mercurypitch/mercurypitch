"""The project one piece of the picture is planned from (DECISIONS 266).

  python3 lab/final-run/piece-root.py <index> <frames a piece> <dir>

Writes <dir>/index.html: the film's own root, its length and every host's data-start unchanged, with
only the scene hosts on screen in the piece's frames kept (with 0.1 s to spare either side), and no
soundtrack (the pieces are picture only). The rest of the project is linked: compositions/,
hyperframes.json, package.json, and assets/ entry by entry but for assets/audio/ (1.4 GB that only
the soundtrack uses: the plan copies the project's media into itself). This is make-proj.sh's "film" mode (lab/integration/film-hops-fix/):
a scene off screen draws nothing, so the piece's frames are the root's, and the plan extracts only
the passes of the scenes it keeps. Prints the scenes kept.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
i, n, out = int(sys.argv[1]), int(sys.argv[2]), os.path.abspath(sys.argv[3])
FPS = 60
a, b = i * n / FPS - 0.1, (i + 1) * n / FPS + 0.1
os.makedirs(out, exist_ok=True)
kept, lines = [], []
for line in open(os.path.join(ROOT, 'index.html')):
    if '<audio id="soundtrack"' in line:
        continue
    m = re.search(r'id="host-([^"]+)".*data-start="([\d.]+)" data-duration="([\d.]+)"', line)
    if m:
        s, d = float(m.group(2)), float(m.group(3))
        if not (s < b and s + d > a):
            continue
        kept.append(m.group(1))
    lines.append(line)
open(os.path.join(out, 'index.html'), 'w').write(''.join(lines))
open(os.path.join(out, 'meta.json'), 'w').write('{\n  "id": "lesson-05-piece-%03d",\n  "name": "lesson-05-piece-%03d"\n}\n' % (i, i))
for e in ('compositions', 'hyperframes.json', 'package.json'):
    p = os.path.join(out, e)
    if not os.path.lexists(p):
        os.symlink(os.path.join(ROOT, e), p)
os.makedirs(os.path.join(out, 'assets'), exist_ok=True)
for e in os.listdir(os.path.join(ROOT, 'assets')):
    p = os.path.join(out, 'assets', e)
    if e != 'audio' and not os.path.lexists(p):
        os.symlink(os.path.join(ROOT, 'assets', e), p)
print(' '.join(kept))
