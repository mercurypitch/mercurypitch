#!/usr/bin/env python3
import pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
CHROME = _os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
EXPL = REPO / "docs/branding/logo/explorations"
OUT = SP / "rendered"; OUT.mkdir(exist_ok=True)
WRAP = """<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:transparent}}
#b{{width:100vw;height:100vh;display:grid;place-items:center}}#b svg{{width:96%;height:96%}}</style><div id="b">{svg}</div>"""
variants = [
 ("v7-glassorb","V7 Glass Orb","Glassy"),("v8-liquidglass","V8 Liquid Glass","Glassy"),
 ("v9-prismdrop","V9 Prism Drop","Glassy · dispersion"),("v10-cratered","V10 Cratered Planet","Planet"),
 ("v11-terminator","V11 Terminator Wave","Planet"),("v12-crescent","V12 Crescent","Planet"),
 ("v13-beads","V13 Mercury Beads","Hybrid · metal"),("v14-tuningfork","V14 Tuning Fork","Hybrid · music"),
 ("v15-soundglobe","V15 Sound Globe","Hybrid · techy"),
]
def render(key,size):
    tmp=SP/"_r2.html"; tmp.write_text(WRAP.format(svg=(EXPL/f"{key}.svg").read_text()))
    subprocess.run([CHROME,"--headless","--no-sandbox","--disable-gpu","--hide-scrollbars",
        "--default-background-color=00000000","--force-device-scale-factor=1",
        f"--window-size={size},{size}",f"--screenshot={OUT/f'{key}.png'}",f"file://{tmp}"],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
for key,_,_ in variants: render(key,512); print("rendered",key)

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if pathlib.Path(p).exists(): return ImageFont.truetype(p,sz)
    return ImageFont.load_default()
def sheet(bg, fg, accent, name):
    cols,rows=3,3; tile=300; pad=24; labelh=52; fav=64
    cw=tile+pad; ch=tile+labelh+pad
    W=cols*cw+pad; H=rows*ch+pad+fav
    img=Image.new("RGB",(W,H),bg); d=ImageDraw.Draw(img)
    fb=font(20); fs=font(14); card=(22,27,34) if bg[0]<100 else (255,255,255)
    for i,(key,nm,ps) in enumerate(variants):
        r,c=divmod(i,cols); x=pad+c*cw; y=pad+r*ch
        d.rounded_rectangle([x,y,x+tile,y+tile],18,fill=card)
        lg=Image.open(OUT/f"{key}.png").convert("RGBA").resize((tile,tile)); img.paste(lg,(x,y),lg)
        d.text((x+4,y+tile+7),nm,font=fb,fill=fg); d.text((x+4,y+tile+31),ps,font=fs,fill=accent)
    fy=H-fav+8; d.text((pad,fy+16),"@32 →",font=fs,fill=(150,160,175)); fx=pad+90
    for key,_,_ in variants:
        f=Image.open(OUT/f"{key}.png").convert("RGBA").resize((32,32))
        d.rounded_rectangle([fx-6,fy+4,fx+38,fy+46],8,fill=card); img.paste(f,(fx,fy+9),f); fx+=64
    img.save(SP/name);
sheet((13,17,23),(230,237,243),(120,180,255),"contact2_dark.png")
sheet((238,241,245),(31,35,40),(9,105,218),"contact2_light.png")
print("sheets done")
