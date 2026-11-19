import sys, subprocess, numpy as np
# usage: stats.py video t0 t1 step  -> t, mean luma, edge detail, mean RGB
v, t0, t1, st = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
t = t0
while t <= t1 + 1e-9:
    raw = subprocess.run(['ffmpeg','-v','error','-ss',f'{t:.4f}','-i',v,'-frames:v','1','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(540,960,3).astype(float)
    y = 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
    gx = np.abs(np.diff(y,axis=1)).mean(); gy = np.abs(np.diff(y,axis=0)).mean()
    m = a.reshape(-1,3).mean(0)
    print(f'{t:.3f} luma {y.mean():6.1f} edge {gx+gy:5.2f} rgb {m[0]:.0f},{m[1]:.0f},{m[2]:.0f}')
    t += st
