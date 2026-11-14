# Port of three.js r185.1 tonemapping_pars_fragment.glsl.js (ACES, AgX, Neutral) to numpy.
# GLSL mat3(a,b,c) takes COLUMNS, so build with np.array([a,b,c]).T
import numpy as np, math
def cols(a,b,c): return np.array([a,b,c],dtype=float).T
ACESIn  = cols([0.59719,0.07600,0.02840],[0.35458,0.90834,0.13383],[0.04823,0.01566,0.83777])
ACESOut = cols([1.60475,-0.10208,-0.00327],[-0.53108,1.10813,-0.07276],[-0.07367,-0.00605,1.07602])
def rrt(v):
    a = v*(v+0.0245786)-0.000090537; b = v*(0.983729*v+0.4329510)+0.238081; return a/b
def aces(c,e):
    c = c*e/0.6; c = ACESIn@c; c = rrt(c); c = ACESOut@c; return np.clip(c,0,1)
R2020toS = cols([1.6605,-0.1246,-0.0182],[-0.5876,1.1329,-0.1006],[-0.0728,-0.0083,1.1187])
StoR2020 = cols([0.6274,0.0691,0.0164],[0.3293,0.9195,0.0880],[0.0433,0.0113,0.8956])
AgxIn = cols([0.856627153315983,0.137318972929847,0.11189821299995],[0.0951212405381588,0.761241990602591,0.0767994186031903],[0.0482516061458583,0.101439036467562,0.811302368396859])
AgxOut = cols([1.1271005818144368,-0.1413297634984383,-0.14132976349843826],[-0.11060664309660323,1.157823702216272,-0.11060664309660294],[-0.016493938717834573,-0.016493938717834257,1.2519364065950405])
def agxc(x):
    x2=x*x; x4=x2*x2
    return 15.5*x4*x2-40.14*x4*x+31.96*x4-6.868*x2*x+0.4298*x2+0.1191*x-0.00232
def agx(c,e):
    mn,mx=-12.47393,4.026069
    c=c*e; c=StoR2020@c; c=AgxIn@c; c=np.maximum(c,1e-10); c=np.log2(c); c=(c-mn)/(mx-mn); c=np.clip(c,0,1)
    c=agxc(c); c=AgxOut@c; c=np.power(np.maximum(c,0),2.2); c=R2020toS@c; return np.clip(c,0,1)
def neutral(c,e):
    sc=0.8-0.04; de=0.15; c=c*e
    x=min(c); off = x-6.25*x*x if x<0.08 else 0.04; c=c-off
    p=max(c)
    if p<sc: return c
    d=1-sc; np_=1-d*d/(p+d-sc); c=c*np_/p; g=1-1/(de*(p-np_)+1); return c*(1-g)+np_*g
def linear(c,e): return np.clip(c*e,0,1)
def s2l(s):
    s=np.array(s,float)/255; return np.where(s<=0.04045,s/12.92,((s+0.055)/1.055)**2.4)
def l2s(l):
    l=np.clip(l,0,1); return np.where(l<=0.0031308,l*12.92,1.055*l**(1/2.4)-0.055)
M1=np.array([[0.4122214708,0.5363325363,0.0514459929],[0.2119034982,0.6806995451,0.1073969566],[0.0883024619,0.2817188376,0.6299787005]])
M2=np.array([[0.2104542553,0.7936177850,-0.0040720468],[1.9779984951,-2.4285922050,0.4505937099],[0.0259040371,0.7827717662,-0.8086757660]])
def oklch(lin):
    lms=M1@np.maximum(lin,0); lab=M2@np.cbrt(lms); L,a,b=lab; return L, math.hypot(a,b), (math.degrees(math.atan2(b,a))%360)
def hexs(l): s=np.round(l2s(l)*255).astype(int); return '#%02X%02X%02X'%tuple(s)
swatches = {
 'amber gold (concept glow) #F2A93B':(0xF2,0xA9,0x3B),
 'deep amber body #B5651D':(0xB5,0x65,0x1D),
 'saturated orange-amber #FF8C00':(0xFF,0x8C,0x00),
 'opal milk #F2F0EC':(0xF2,0xF0,0xEC),
 'opal mint #CDEBDD':(0xCD,0xEB,0xDD),
 'opal lavender #D9CCF0':(0xD9,0xCC,0xF0),
 'champagne #F7E7CE':(0xF7,0xE7,0xCE),
 'amethyst #9966CC':(0x99,0x66,0xCC),
 'jade #00A86B':(0x00,0xA8,0x6B),
 'gold trim #D4AF37':(0xD4,0xAF,0x37),
}
import sys
E=float(sys.argv[1]) if len(sys.argv)>1 else 1.2
print(f'exposure={E}  (input = sRGB swatch decoded to linear, scaled by radiance multiplier k)')
print('Format: out hex | OKLCh L C h | dHue(deg) dChroma% vs input swatch')
for name,s in swatches.items():
    lin=s2l(s); L0,C0,h0=oklch(lin)
    print(f'\n{name}: input OKLCh L={L0:.3f} C={C0:.3f} h={h0:.1f}')
    for k in (0.5,1.0,2.0,4.0):
        row=[]
        for fn,lab in ((linear,'Lin'),(aces,'ACES'),(agx,'AgX'),(neutral,'Neut')):
            o=fn(lin*k,E); L,C,h=oklch(o)
            dh=((h-h0+180)%360)-180 if C>0.005 else float('nan')
            row.append(f'{lab}:{hexs(o)} L{L:.2f} C{C:.3f} dh{dh:+.1f} dC{(C/C0-1)*100 if C0>1e-4 else 0:+.0f}%')
        print(f'  k={k:<3}', ' | '.join(row))
