# Where a flagged single-frame event happens: for each time, the frames before and after it in the clip (30 fps),
# the bounding boxes of the pixels that change by more than 24 (luma, full size), clustered by a coarse grid.
#   python3 where.py <clip.mp4> t1,t2,...
import subprocess, sys, numpy as np
clip, ts = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
def frame(i):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-vf', f'select=eq(n\\,{i})', '-vsync', '0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920).astype(np.int16)
for t in ts:
    n = round(t * 30)
    f = [frame(n - 1), frame(n), frame(n + 1)]
    for k, (a, b) in enumerate([(f[0], f[1]), (f[1], f[2])]):
        d = np.abs(b - a) > 24
        ys, xs = np.nonzero(d)
        if not len(xs):
            print(f'{t:7.3f} frame {n - 1 + k}->{n + k}: no change > 24'); continue
        # cells of 40 px holding changes
        cells = sorted({(x // 120, y // 120) for x, y in zip(xs, ys)})
        print(f'{t:7.3f} frame {n - 1 + k}->{n + k}: {len(xs)} px, box x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}; cells(120px) {cells[:12]}')
