# track.py <fps> <before.mp4> [<after.mp4>]: Merc through the two recap hops in a window of the film's own
# frames (film 488 s on, window.mjs), frame by frame.
#   cx      mean x of Merc's bright pixels (luma > 70, y 520-850, x < 1500): hops-film-01.txt's measure
#   shown   the pass frame the renderer shows: its cut of the pass (ffmpeg -ss 0.050, pts less 0.5 ms,
#           fps=F round=up; ffmpeg-model/model.txt) at k = floor((t - 462.370) F)
#   before  the frame L.mercGate read: floor((t - 462.370 + 0.050) x 30)
#   after   L.passFrame (the fixed kit), computed here the same way the kit does
#   err     (root[shown] - root[read]) x 0.4353 x 300 px: how far the body sits off its place
#   d cx    cx(after) - cx(before), measured, and the change the index predicts, (root[before] - root[after]) x 130.6
# Rows: pass frames 838 to 900 (hop 1 lifts at 842, hop 2 lands at 874 and its root is back at 0 by 890).
# The maxima are over pass frames 842 to 900: until 490.40 s the recap's chart is still fading out of the
# measured band, and its pixels move cx.
import json, math, re, subprocess, sys
fps = int(sys.argv[1]); vids = sys.argv[2:]
P = '/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film'
txt = open(P + '/assets/merc/roots.js').read()
roots = json.loads(txt[txt.index('{', txt.index('window.MERC_ROOTS')):].rstrip().rstrip(';'))['m-blue-s13']['frames']
S0, MS, PF, K = 462.370, 0.050, 30, 0.4353 * 300
def shown(k, F):
    lim = 1000 * MS + 0.5 + 1000 * k / F + 1e-6
    i = math.floor(lim / 1000 * PF) + 1
    while i > 0 and round(i * 1000 / PF) > lim: i -= 1
    return i
def pass_frame(t, F):  # the kit's L.passFrame, line for line
    k = math.floor((t - 0) * F + 1e-6)
    return shown(k, F)
rx = lambda i: roots[max(0, min(len(roots) - 1, i))][0]
def track(path):
    W, H, y0, y1 = 1920, 1080, 520, 850  # 330 rows: a crop of a 4:2:0 frame keeps an even height
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'crop=1500:{y1 - y0}:0:{y0},format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    import numpy as np
    n, out = 1500 * (y1 - y0), []
    xs = np.arange(1500)
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        a = np.frombuffer(b, np.uint8).reshape(y1 - y0, 1500) > 70
        c = a.sum(0)
        out.append(float((c * xs).sum() / c.sum()) if c.sum() else float('nan'))
    return out
cxs = [track(v) for v in vids]
rows = []
hdr = f'{"frame":>6} {"film t":>8} {"shown":>5} {"before":>6} {"after":>5} {"root[shown]":>11} {"err before":>10} {"err after":>9} ' + ' '.join(f'{"cx " + l:>10}' for l in ['before', 'after'][:len(vids)]) + ('   d cx  predicted' if len(vids) == 2 else '')
rows.append(hdr)
n0 = 488 * fps
stats = {'max |err before|': 0, 'max |err after|': 0, 'max |d cx - predicted|': 0}
for j in range(min(len(c) for c in cxs)):
    n = n0 + j; T = n / fps; t = T - S0
    k = math.floor((T - S0) * fps + 1e-9)
    sh = shown(k, fps)
    bf = math.floor((t + MS) * PF + 1e-6)
    af = pass_frame(t, fps)
    eb, ea = (rx(sh) - rx(bf)) * K, (rx(sh) - rx(af)) * K
    inside = 842 <= sh <= 900
    if inside: stats['max |err before|'] = max(stats['max |err before|'], abs(eb)); stats['max |err after|'] = max(stats['max |err after|'], abs(ea))
    line = f'{n:>6} {T:>8.3f} {sh:>5} {bf:>6} {af:>5} {rx(sh):>11.4f} {eb:>10.1f} {ea:>9.1f} ' + ' '.join(f'{c[j]:>10.1f}' for c in cxs)
    if len(vids) == 2:
        d, pr = cxs[1][j] - cxs[0][j], (rx(bf) - rx(af)) * K
        if inside: stats['max |d cx - predicted|'] = max(stats['max |d cx - predicted|'], abs(d - pr))
        line += f' {d:>7.1f} {pr:>9.1f}'
    if 838 <= sh <= 900: rows.append(line)
print('\n'.join(rows))
print('; '.join(f'{k} {v:.1f} px' for k, v in stats.items()) + f'  (pass frames 842-900, {fps} fps)')
