# The pixels behind each single-frame event measure.py lists: for each time, the frames either side, the count of pixels
# changing by more than 24 and the box they lie in (in the clip's own pixels).
#   python3 where.py <clip.mp4> t1,t2,...
import subprocess, sys
import numpy as np
from PIL import Image
import io
clip, times = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
def frame(t):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.4f}', '-i', clip, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
    return np.asarray(Image.open(io.BytesIO(out)).convert('L'), dtype=np.int16)
for t in times:
    fs = [frame(t + k / 30 - 0.001) for k in (-2, -1, 0, 1)]
    for k in range(1, 4):
        d = np.abs(fs[k] - fs[k - 1]) > 24
        ys, xs = np.where(d)
        print(f'{t:.3f} [{k - 2:+d}->{k - 1:+d}] {d.sum():6d} px', (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())) if len(xs) else '')
