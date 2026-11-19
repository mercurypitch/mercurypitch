# which-frame.py <dbg.txt> [<plain track.txt> <col>]: for each frame of a debug render (decode-dbg.py), which
# pass frame Merc's pixels say the renderer showed: cx - (the gate's box x) against each pass frame's own
# centroid offset (pass-pose.txt: cx in pass - 150), the nearest of the shown frame and its neighbours.
# With a plain render's track (same kit, same times), its cx is read against the debug render's box x.
import sys
pose = {}
for l in open('pass-pose.txt'):
    f = l.split()
    if f and f[0].isdigit(): pose[int(f[0])] = float(f[2]) - 150
dbg = [l.split() for l in open(sys.argv[1]) if l.split() and l.split()[0].isdigit()]
plain = {}
if len(sys.argv) > 3:
    c = int(sys.argv[3])
    for l in open(sys.argv[2]):
        f = l.split()
        if f and f[0].isdigit() and len(f) > c: plain[f[0]] = float(f[c])
agree = n = 0; off = []
for f in dbg:
    sh, box = int(f[6]), float(f[8])
    if not (842 <= sh <= 890) or box < 0: continue
    cx = plain.get(f[0]) if plain else float(f[7])
    if cx is None: continue
    cand = {j: abs(cx - box - pose[j]) for j in range(sh - 2, sh + 3) if j in pose}
    best = min(cand, key=cand.get)
    n += 1; agree += best == sh
    if best != sh: off.append(f'{f[0]} shown {sh} pixels say {best} (resid {cx - box - pose[sh]:+.1f} px)')
print(f'{n} hop frames: pixels match the shown pass frame on {agree}')
print('\n'.join(off[:20]))
