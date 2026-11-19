# LAB-CHECKS 15 and HANDOFFS § Provisional values (Merc's arc reach beside the care block, m-blue at 300): the
# rightmost and topmost pixel of m-blue's chunk with alpha over a threshold, frame by frame, mapped to the screen
# (the corners' box: feet (110, 840), 300 px shown from the 225 px pass, left = 110 - 150, top = 840 - 0.836 x 300).
#   python3 lab/s12-your-turn/arcs/arcs.py assets/merc/m-blue-s12-merc.webm <filmStart> <out.csv>
import subprocess, sys, numpy as np
src, film0, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
W = 225
S = 300 / W
LEFT, TOP = 110 - 150, 840 - 0.836 * 300
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], stdout=subprocess.PIPE)
rows = []
i = 0
while True:
    buf = p.stdout.read(W * W * 4)
    if len(buf) < W * W * 4:
        break
    a = np.frombuffer(buf, np.uint8).reshape(W, W, 4)[:, :, 3]
    rec = [i, film0 + i / 30]
    for th in (8, 32, 128):
        ys, xs = np.nonzero(a > th)
        if len(xs):
            rec += [LEFT + (xs.max() + 1) * S, TOP + ys.min() * S]
        else:
            rec += [float('nan'), float('nan')]
    rows.append(rec)
    i += 1
np.savetxt(out, np.array(rows), delimiter=',', fmt='%.2f', header='frame,film,right8,top8,right32,top32,right128,top128', comments='')
print(out, i, 'frames')
