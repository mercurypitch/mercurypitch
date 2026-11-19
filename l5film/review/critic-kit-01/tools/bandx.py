import sys, subprocess, numpy as np
v=sys.argv[1]
for t in sys.argv[2:]:
    raw=subprocess.run(['ffmpeg','-v','error','-ss',t,'-i',v,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    a=np.frombuffer(raw,np.uint8).reshape(1080,1920,3).astype(int)
    # amber line: r>200, g 120-180, b<60
    m=(a[...,0]>200)&(a[...,1]>110)&(a[...,1]<190)&(a[...,2]<80)
    ys,xs=np.where(m)
    # violet strip edge: find violet pixels
    vm=(a[...,2]>200)&(a[...,0]>130)&(a[...,0]<190)&(a[...,1]<170)
    vy,vx=np.where(vm)
    print(t,'amber x',xs.min(),xs.max(),'y',int(np.median(ys)),'| violet x',vx.min(),vx.max(),'y',vy.min(),vy.max())
