import subprocess, sys, numpy as np, io
from PIL import Image
clip=sys.argv[1]; times=[float(t) for t in sys.argv[2:]]
def frame(t):
    out=subprocess.run(['ffmpeg','-v','error','-ss',f'{t:.4f}','-i',clip,'-frames:v','1','-f','image2pipe','-vcodec','png','-'],capture_output=True).stdout
    return np.asarray(Image.open(io.BytesIO(out)).convert('L')).astype(int)
for t in times:
    fs=[frame(t+k/30) for k in (-1,0,1)]
    for name,(a,b) in (('prev->ev',(0,1)),('ev->next',(1,2))):
        d=np.abs(fs[b]-fs[a]); m=d>24
        if m.sum()==0: print(t,name,'no change'); continue
        ys,xs=np.nonzero(m)
        print(f"{t:.3f} {name}: {m.sum()} px >24, bbox x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}, max {d.max()}")
