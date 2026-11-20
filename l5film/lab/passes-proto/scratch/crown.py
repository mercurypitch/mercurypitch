import subprocess, sys, numpy as np
webm, f0, f1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
raw = subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-c:v','libvpx-vp9','-i',webm,'-vf',f"select='between(n\\,{f0}\\,{f1})'",'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgba','-'],capture_output=True,check=True).stdout
w = h = int((len(raw) / (f1 - f0 + 1) / 4) ** 0.5)
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4)
for k, f in enumerate(fr):
    a = (f[..., 3].astype(np.float32) / 255)
    solid = (a > 0.9)
    col = solid[:, w // 2 - 3: w // 2 + 4].any(axis=1)
    top = np.argmax(col)
    # sub-pixel: the opaque share of the centre columns' pixels above the first solid row
    band = a[max(0, top - 6): top, w // 2 - 3: w // 2 + 4].mean(axis=1).sum()
    print(f0 + k, f'{top - band:.2f}')
