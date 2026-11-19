# Fix round F-01 (DECISIONS 233): the swatch names' rise, frame by frame, before (the film draft) and after (this
# clip). Each name's ink rows (x 430 to 600 "whisper", 760 to 1160 "about speaking volume"), the vertical centroid of
# the pixels over 60 luma, in px from the crop's top. Whole-pixel steps after a held frame are measure.py's jumps.
#   python3 -I name_trace.py <film-draft-01.mp4> <lab/s04-recall/clip.mp4> <workdir>
import glob, os, subprocess, sys
import numpy as np
from PIL import Image
film, clip, work = sys.argv[1:4]
for d, src, ss, top in (('old', film, 54.9, 540), ('new', clip, 54.9 - 52.88, 640)):
    os.makedirs(os.path.join(work, d), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', '1.5', '-i', src, '-vf', f'crop=1920:300:0:{top}', os.path.join(work, d, 'f%03d.png')], check=True)
def trace(d, base):
    out = []
    for f in sorted(glob.glob(os.path.join(work, d, '*.png'))):
        a = np.asarray(Image.open(f).convert('L')).astype(float)
        row = []
        for x0, x1 in ((430, 600), (760, 1160)):
            w = np.clip(a[base - 45:base + 15, x0:x1] - 60, 0, None)
            row.append(None if w.sum() < 500 else (w.sum(1) * np.arange(w.shape[0])).sum() / w.sum())
        out.append(row)
    return out
o, n = trace('old', 90), trace('new', 91)       # the names' baselines: 630 (old F-strip) and 731 (F-01)
fa = lambda v: '   -  ' if v is None else '%6.2f' % v
print('film t   before: whisper  about  |  after: whisper  about')
for i, (a, b) in enumerate(zip(o, n)):
    print('%.3f   %s %s   |   %s %s' % (54.9 + i / 30, fa(a[0]), fa(a[1]), fa(b[0]), fa(b[1])))
