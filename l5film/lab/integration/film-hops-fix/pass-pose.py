# pass-pose.py: Merc's own pass (assets/merc/m-blue-s13-merc.webm) through the hops, frame by frame: the
# centroid x of his bright pixels (luma > 70, as track.py measures the screen) less his renderer root x
# (the part mercGate cancels), in screen px at size 300. Where this moves between neighbouring pass frames,
# two renders that show neighbouring frames at the same time differ by that much even when both cancel right.
import json, subprocess
import numpy as np
P = '/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film'
txt = open(P + '/assets/merc/roots.js').read()
roots = json.loads(txt[txt.index('{', txt.index('window.MERC_ROOTS')):].rstrip().rstrip(';'))['m-blue-s13']['frames']
W = 225
raw = subprocess.run(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', P + '/assets/merc/m-blue-s13-merc.webm', '-vf', "select='between(n,836,900)',format=rgba", '-vsync', '0', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, W, W, 4)
sc = 300 / W
print(f'{"pass":>4} {"root x":>7} {"cx in pass (screen px)":>22} {"less root":>9} {"step":>6}')
prev = None
for j, f in enumerate(fr):
    i = 836 + j
    a = f[..., 3].astype(float) / 255
    lum = (0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]) * a
    m = lum > 70
    cx = (m.sum(0) * np.arange(W)).sum() / max(1, m.sum()) * sc
    rel = cx - roots[i][0] * 0.4353 * 300
    print(f'{i:>4} {roots[i][0]:>7.4f} {cx:>22.1f} {rel:>9.1f} {"" if prev is None else f"{rel - prev:6.1f}"}')
    prev = rel
