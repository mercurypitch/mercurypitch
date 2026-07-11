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
SG = REPO / "docs/branding/logo/soundglobe"
OUT = SP / "sg"; OUT.mkdir(exist_ok=True)
FONTCSS = ""  # rely on Outfit/Inter fallback for text renders is fine for preview

def render(svg_file, out_png, w, h, transparent=True):
    svg = pathlib.Path(svg_file).read_text()
    wrap = f"""<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:transparent}}
    #b{{width:100vw;height:100vh;display:grid;place-items:center}}#b svg{{width:100%;height:100%}}</style><div id="b">{svg}</div>"""
    tmp = SP/"_sg.html"; tmp.write_text(wrap)
    args=[CHROME,"--headless","--no-sandbox","--disable-gpu","--hide-scrollbars",
        "--force-device-scale-factor=1",f"--window-size={w},{h}",f"--screenshot={out_png}",f"file://{tmp}"]
    if transparent: args.insert(5,"--default-background-color=00000000")
    subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)

render(SG/"soundglobe-mark.svg", OUT/"mark.png", 512,512)
render(SG/"soundglobe-app-icon.svg", OUT/"appicon.png", 512,512)
render(SG/"soundglobe-lockup-horizontal.svg", OUT/"lockh.png", 780,210)
render(SG/"soundglobe-lockup-stacked.svg", OUT/"stacked.png", 540,450)
render(SG/"soundglobe-og.svg", OUT/"og.png", 1200,630)
render(SG/"soundglobe-mark-mono-light.svg", OUT/"mono.png", 256,256)

# contact: mark on dark, on light, favicon sizes, app icon
def font(sz):
    p="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    return ImageFont.truetype(p,sz) if pathlib.Path(p).exists() else ImageFont.load_default()
mark=Image.open(OUT/"mark.png").convert("RGBA")
W,H=1000,430
img=Image.new("RGB",(W,H),(13,17,23)); d=ImageDraw.Draw(img); fb=font(18)
# dark tile
d.rounded_rectangle([30,30,290,290],20,fill=(22,27,34)); img.paste(mark.resize((240,240)),(40,40),mark.resize((240,240)))
d.text((40,300),"on dark",font=fb,fill=(168,179,191))
# light tile
d.rounded_rectangle([320,30,580,290],20,fill=(246,248,250)); img.paste(mark.resize((240,240)),(330,40),mark.resize((240,240)))
d.text((330,300),"on light",font=fb,fill=(168,179,191))
# app icon
ai=Image.open(OUT/"appicon.png").convert("RGBA")
img.paste(ai.resize((150,150)),(620,40),ai.resize((150,150)))
d.text((620,300),"app tile",font=fb,fill=(168,179,191))
# favicon strip
d.text((790,44),"favicons",font=fb,fill=(168,179,191))
fx=790; fy=80
for sz in (16,24,32,48,64):
    f=mark.resize((sz,sz)); img.paste(f,(fx,fy),f); fx+=sz+12
d.text((790,150),"16 · 24 · 32 · 48 · 64",font=font(13),fill=(110,118,129))
# lockup preview
lk=Image.open(OUT/"lockh.png").convert("RGBA")
img.paste(lk.resize((540,145)),(40,340) if False else (620,150),lk.resize((540,145)) if False else None) if False else None
img.save(SP/"sg_contact.png")
print("done")
